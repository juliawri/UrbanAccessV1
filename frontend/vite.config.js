import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/process': 'http://localhost:8000',
      '/stops':   'http://localhost:8000',
      '/submit':  'http://localhost:8000',
    },
  },
})