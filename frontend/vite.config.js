import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Path alias used by shadcn/ui components (e.g. "@/components/ui/button")
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    // Allow external connections (local tunnels / teammates).
    host: true,
    allowedHosts: true,
    strictPort: true,
    proxy: {
      // Forward API calls to the FastAPI backend during development,
      // avoiding CORS entirely in the browser — including when the app
      // is reached through a local tunnel.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
