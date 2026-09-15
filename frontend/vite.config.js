import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages sert le site depuis /NOM_DU_REPO/ et non depuis la racine.
  base: '/collection-2-euros/',
})