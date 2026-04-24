import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Ensure PRIVATE_KEY and other non-VITE_ vars are never accidentally bundled
  envPrefix: 'VITE_',

  build: {
    // Warn when a chunk exceeds 600 kB
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split large vendor libraries into separate chunks for better caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-stellar': ['@stellar/stellar-sdk', '@stellar/freighter-api'],
          'vendor-clerk': ['@clerk/clerk-react'],
        },
      },
    },
  },

  server: {
    // Prevent CORS issues when calling local APIs during development
    cors: true,
  },
})
