import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/process':      'http://localhost:8000',
      '/stops':        'http://localhost:8000',
      '/submit':       'http://localhost:8000',
      '/api/feedback': 'http://localhost:8000',
    },
  },
})

