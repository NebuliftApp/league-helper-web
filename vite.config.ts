import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/league-helper-web/ so assets need the repo base.
export default defineConfig({
  base: '/league-helper-web/',
  plugins: [react()],
})
