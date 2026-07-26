import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => chemins relatifs, fonctionne tel quel sur GitHub Pages
// (project pages ou user pages, sans configuration supplémentaire)
export default defineConfig({
  plugins: [react()],
  base: './',
})
