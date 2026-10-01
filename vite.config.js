import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep the vendor code out of the app chunk so pages stay small on mobile data.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router)/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-|internmap|decimal\.js)/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react/ },
          ],
        },
      },
    },
  },
})