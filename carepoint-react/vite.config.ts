import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      port: 5174,
      // Forward /api calls to the backend during development (set VITE_API_PROXY in .env.local).
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:8001',
          changeOrigin: true,
        },
      },
    },
  }
})
