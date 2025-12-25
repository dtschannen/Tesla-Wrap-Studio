import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configure asset handling for src/assets/wraps
  publicDir: 'public', // Enable public directory for Godot files
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.bin'], // Include GLTF, GLB and binary files as assets
  resolve: {
    alias: {
      '@assets': resolve(__dirname, './src/assets'),
    },
  },
  // Serve assets from src/assets in development
  server: {
    fs: {
      allow: ['..'],
    },
    // Configure MIME types for Godot files
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  // Configure build to handle Godot files
  build: {
    rollupOptions: {
      output: {
        // Ensure Godot files are copied as-is
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm') || assetInfo.name?.endsWith('.pck')) {
            return 'godot/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
})
