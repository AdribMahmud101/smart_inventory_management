import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Path alias used by shadcn/ui components (e.g. "@/components/ui/button")
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Forward API calls to the FastAPI backend during development,
      // avoiding CORS entirely in the browser.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
