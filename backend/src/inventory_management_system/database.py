"""Database connection module.

Provides a small helper to open a connection to PostgreSQL using psycopg.
No ORM here — we use raw SQL only.

Credentials come from environment variables so we never hard-code real
secrets, but sensible defaults are provided for local development.
"""

import os

import psycopg

# Read connection details from environment variables, falling back to
# local-development defaults. These defaults mirror a typical local
# PostgreSQL setup (`createdb`, default user, no password).
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def get_connection() -> psycopg.Connection:
    """Open and return a connection to PostgreSQL.

    Returns:
        psycopg.Connection: An active connection, ready to run raw SQL.

    Raises:
        psycopg.OperationalError: if the database cannot be reached.
    """
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def init_db() -> None:
    """Apply the SQL schema to the database.

    Reads `schema.sql`, executes every statement against a fresh connection,
    and closes it. Useful as a one-time setup step during development.
    """
    # Build the path to schema.sql relative to THIS file, so it works
    # regardless of which directory the app is launched from.
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")

    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()