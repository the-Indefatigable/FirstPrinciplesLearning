import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('katex')) return 'vendor-katex';
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('mathjs')) return 'vendor-math';
          // plotly-gl3d.min.js — keep in its own long-lived cache chunk
          if (id.includes('plotly') || id.includes('react-plotly')) return 'vendor-plotly';
          if (id.includes('node_modules/react-dom')) return 'vendor-react-dom';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor-react';
        },
      },
    },
  },
})
