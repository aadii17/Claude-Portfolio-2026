import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // FoldfolioDevice.tsx (the Framer component) imports from "framer"; this stand-in replaces it.
    alias: { framer: fileURLToPath(new URL('./src/components/foldfolio/framer-shim.ts', import.meta.url)) },
  },
  server: { host: true }, // also on your LAN IP, to test tilt/shake on a phone
})
