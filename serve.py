#!/usr/bin/env python3
"""
serve.py — boot the ENTIRE Smart Inventory system with ONE command.

    python3 serve.py

This manager:
  1. Creates the demo database (inventory_test) if missing + applies the schema
  2. Starts the FastAPI backend  (uv run uvicorn ... :8000)   [with health check]
  3. Starts the Vite frontend    (npm run dev ... :5173 --host)
  4. Spawns a local tunnel (npx localtunnel --port 5173) to expose the app
     to external teammates over the internet
  5. Prints a formatted banner: local URLs + the Teammate Live Share URL
  6. Gracefully shuts everything down on Ctrl+C / SIGTERM (no orphans)

Only the Python standard library is used — no extra tools are installed.
"""

import os
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.request

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_PORT = "5173"

DB_NAME = os.environ.get("DB_NAME", "inventory_test")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")

# Regex used to spot the public HTTPS URL among the tunnel's stdout lines.
PUBLIC_URL_RE = re.compile(
    r"https://[\w.-]+\.(?:loca\.lt|pinggy-free\.link|free\.pinggy\.net)\b"
)

# Track every child process so cleanup is exhaustive.
CHILDREN = []

# Env inherited by every child: DB_NAME is CRITICAL so the backend talks to
# the demo database "inventory_test" (not the default "postgres").
CHILD_ENV = {
    **os.environ,
    "DB_NAME": DB_NAME,
    "DB_USER": DB_USER,
    "DB_PASSWORD": DB_PASSWORD,
}


def out(text):
    sys.stdout.write(text + "\n")
    sys.stdout.flush()


def _port_free(port):
    """Return True if nothing is listening on 127.0.0.1:PORT anymore."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def stop_stale():
    """Kill any servers left over from a previous run so WE own the ports.

    Mirrors serve.sh's "restart fresh" behaviour: backend, frontend and any
    other serve.py manager are SIGTERM'd first (their own shutdown handlers
    then clean up their children), and we wait until ports 8000/5173 are
    actually free before continuing. The [x] bracket trick keeps the pkill
    pattern from matching our own command line.
    """
    out("[setup] stopping any already-running servers ...")
    for pat in ("[u]vicorn inventory_management_system", "[v]ite",
                "[l]ocaltunnel", "[a]\\.pinggy\\.io"):
        subprocess.run(["pkill", "-f", pat], capture_output=True)
    # Stop older serve.py managers too, but NEVER our own process — and only
    # real python processes, so a shell whose prompt merely TEXT-contains
    # "serve.py" (e.g. `bash -c "python3 serve.py ..."`) can never match.
    try:
        ps = subprocess.run(
            ["ps", "-eo", "pid=,comm=,args="], capture_output=True, text=True
        ).stdout
        for line in ps.splitlines():
            fields = line.split(None, 2)
            if len(fields) < 2:
                continue
            pid, comm = int(fields[0]), fields[1]
            if comm.startswith("python") and "serve.py" in fields[2]:
                if pid != os.getpid():
                    try:
                        os.kill(pid, signal.SIGTERM)
                    except (ProcessLookupError, PermissionError):
                        pass
    except OSError:
        pass
    # Give the processes a moment to die and release the ports.
    for port in (8000, 5173):
        deadline = time.time() + 10
        while time.time() < deadline and not _port_free(port):
            time.sleep(0.3)
        out(f"[setup] port {port} is now free")


# ------------------------------------------------------------------
# Process helpers
# ------------------------------------------------------------------
def spawn(cwd, *cmd, extra_env=None):
    """Start a child process with a text-mode pipe for streaming."""
    env = {**CHILD_ENV, **(extra_env or {})}
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.PIPE,          # allows answering tunnel prompts
        text=True,
        bufsize=1,
    )
    CHILDREN.append(proc)
    return proc


def stream(proc, prefix, on_line=None):
    """Read a child's stdout line-by-line and forward it to the console."""
    def _pump():
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                out(f"[{prefix}] {line}")
            if on_line:
                on_line(line)
    threading.Thread(target=_pump, daemon=True).start()


# ------------------------------------------------------------------
# Database preparation (mirrors serve.sh)
# ------------------------------------------------------------------
def ensure_database():
    """Create the demo DB if missing, then apply the idempotent schema."""
    code = f"""
import psycopg
from inventory_management_system.database import init_db

conn = psycopg.connect(
    host="localhost", port="5432", dbname="postgres",
    user="{DB_USER}", password="{DB_PASSWORD}", autocommit=True,
)
with conn.cursor() as cur:
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("{DB_NAME}",))
    if cur.fetchone() is None:
        cur.execute("CREATE DATABASE {DB_NAME}")
conn.close()

init_db()
"""
    subprocess.run(
        ["uv", "run", "python", "-c", code],
        cwd=BACKEND_DIR,
        env={**os.environ, "DB_NAME": DB_NAME},
        check=True,
    )
    out(f"[setup] database '{DB_NAME}' ready (schema applied)")


# ------------------------------------------------------------------
# Backend: launch + health check with retries
# ------------------------------------------------------------------
def start_backend():
    out("[backend] starting ...")
    proc = spawn(BACKEND_DIR, "uv", "run", "uvicorn",
                 "inventory_management_system.main:app",
                 "--host", "127.0.0.1", "--port", "8000")
    stream(proc, "backend")

    # Poll until the API answers 200 (max ~40 s).
    deadline = time.time() + 40
    while time.time() < deadline:
        # If uvicorn itself died (e.g. port already in use before our
        # cleanup), do NOT trust a healthy reply from a stale server.
        if proc.poll() is not None:
            out("[backend] ERROR: uvicorn exited (port 8000 busy?)")
            shutdown()
            sys.exit(1)
        try:
            with urllib.request.urlopen(BACKEND_URL, timeout=2) as resp:
                if resp.status == 200:
                    out("[backend] healthy on " + BACKEND_URL)
                    return
        except Exception:
            time.sleep(0.5)
    out("[backend] ERROR: did not become healthy in time.")
    shutdown()
    sys.exit(1)


# ------------------------------------------------------------------
# Frontend: boot + wait for listening port
# ------------------------------------------------------------------
def start_frontend():
    out("[frontend] starting ...")
    proc = spawn(
        FRONTEND_DIR,
        "npm", "run", "dev", "--", "--port", FRONTEND_PORT, "--host",
    )
    stream(proc, "frontend")

    front_url = f"http://localhost:{FRONTEND_PORT}"
    deadline = time.time() + 30
    while time.time() < deadline:
        # If Vite died (e.g. port already in use), a stale process must not
        # make us report a healthy frontend.
        if proc.poll() is not None:
            out(f"[frontend] ERROR: Vite exited (port {FRONTEND_PORT} busy?)")
            shutdown()
            sys.exit(1)
        if _port_ready(FRONTEND_PORT):
            out("[frontend] ready on " + front_url)
            return
        time.sleep(0.5)
    out("[frontend] ERROR: Vite did not come up in time.")
    sys.exit(1)


def _port_ready(port):
    """Cheap connectivity probe: try to open a TCP socket on the port."""
    import socket
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=1):
            return True
    except OSError:
        return False


def _make_askpass():
    """Write a tiny helper that prints an empty line for ssh's password.

    Used only by the Pinggy tunnel option (`TUNNEL=pinggy`): its free tier
    logs you in with an EMPTY password. In an interactive terminal ssh would
    normally stop at `free@a.pinggy.io's password:` — SSH_ASKPASS forces ssh
    to fetch the (empty) password from this helper, so no prompt appears.
    """
    import tempfile
    fd, path = tempfile.mkstemp(prefix="pinggy-askpass-")
    with os.fdopen(fd, "w") as fh:
        fh.write("#!/bin/sh\nprintf '\\n'\n")
    os.chmod(path, 0o700)
    return path


# ------------------------------------------------------------------
# Tunnel (DEFAULT): localtunnel — relays ALL traffic incl. JSON API logins
# ------------------------------------------------------------------
def start_tunnel():
    out("[tunnel] starting localtunnel ... this can take a moment (npx download).")
    proc = spawn(FRONTEND_DIR,
                 "npx", "--yes", "localtunnel", "--port", FRONTEND_PORT)

    url_holder = {}
    def on_line(line):
        low = line.lower()
        # localtunnel asks for Enter in odd network setups — auto-accept.
        if "enter" in low and ("press" in low or "continue" in low):
            try:
                proc.stdin.write("\n")
                proc.stdin.flush()
            except OSError:
                pass
        m = PUBLIC_URL_RE.search(line)
        if m and not url_holder:
            url_holder["url"] = m.group(0)
    stream(proc, "tunnel", on_line)

    # Wait up to ~60 s for the public URL to appear in the output.
    deadline = time.time() + 60
    while time.time() < deadline and "url" not in url_holder:
        time.sleep(0.5)
    return url_holder.get("url")


# ------------------------------------------------------------------
# Tunnel (OPTIONAL, TUNNEL=pinggy): Pinggy SSH tunnel.
# NOTE: Pinggy's FREE tier serves a consent/debug page to API requests, so
# teammate logins will NOT return JSON through it; kept here for reference.
# ------------------------------------------------------------------
def start_tunnel_pinggy():
    out("[tunnel] starting Pinggy SSH tunnel (http://a.pinggy.io) ...")
    askpass = _make_askpass()
    proc = spawn(
        ROOT,
        "ssh",
        "-p", "443",
        "-R0:localhost:%s" % FRONTEND_PORT,
        "-o", "StrictHostKeyChecking=no",
        "-o", "LogLevel=ERROR",
        "free@a.pinggy.io",
        extra_env={
            "SSH_ASKPASS": askpass,
            "SSH_ASKPASS_REQUIRE": "force",
            "DISPLAY": ":0",
        },
    )

    url_holder = {}
    def on_line(line):
        m = PUBLIC_URL_RE.search(line)
        if m and not url_holder:
            url_holder["url"] = m.group(0)
    stream(proc, "tunnel", on_line)

    deadline = time.time() + 60
    while time.time() < deadline and "url" not in url_holder:
        time.sleep(0.5)
    return url_holder.get("url")


# ------------------------------------------------------------------
# Banner
# ------------------------------------------------------------------
def print_banner(public_url):
    line = "=" * 70
    out("")
    out(line)
    out("  Smart Inventory :: LIVE SHARE")
    out(line)
    out("  Backend API (Local):      " + BACKEND_URL)
    out(f"  Frontend App (Local):     http://localhost:{FRONTEND_PORT}")
    out("  Teammate Live Share URL:  " + (public_url or "NOT FOUND (tunnel failed)"))
    out("-" * 62)
    out("  Send the Live Share URL to your teammate; the app is fully usable")
    out("  (login, POS, products, dashboard) through the single tunnel port.")
    out("  PostgreSQL is only needed on YOUR machine — the backend stays private.")
    out("-" * 62)
    out("  Press Ctrl+C to stop all services.")
    out(line)
    out("")


# ------------------------------------------------------------------
# Shutdown: kill every child + force-release ports
# ------------------------------------------------------------------
def shutdown(_signum=None, _frame=None):
    """Terminate all spawned processes (SIGTERM -> SIGKILL) and exit."""
    out("")
    out("Shutting down all services ...")
    for proc in CHILDREN:
        if proc.poll() is None:
            try:
                proc.terminate()
            except OSError:
                pass
    time.sleep(1)
    for proc in CHILDREN:
        if proc.poll() is None:
            try:
                proc.kill()
            except OSError:
                pass
    # Defensive: clear anything still squatting on our ports.
    for pat in ("[u]vicorn inventory_management_system", "[v]ite"):
        subprocess.run(["pkill", "-f", pat], capture_output=True)
    out("All services stopped. Goodbye!")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, shutdown)   # Ctrl+C
    signal.signal(signal.SIGTERM, shutdown)

    if not os.path.isdir(BACKEND_DIR) or not os.path.isdir(FRONTEND_DIR):
        out("ERROR: missing backend/ or frontend/ folder — run from the repo root.")
        sys.exit(1)

    stop_stale()

    ensure_database()
    start_backend()

    # TUNNEL=pinggy uses the Pinggy SSH tunnel; default is localtunnel,
    # which is the one that actually relays JSON API logins on the free tier.
    tunnel_fn = start_tunnel_pinggy if os.environ.get("TUNNEL") == "pinggy" else start_tunnel
    public_url = tunnel_fn()
    start_frontend()

    print_banner(public_url)

    # Keep the main thread alive; Ctrl+C is handled by the signal handler.
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()