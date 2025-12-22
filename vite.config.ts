import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configure asset handling for src/assets/wraps
  publicDir: false, // We're not using public dir for these assets
  assetsInclude: ['**/*.obj'], // Include OBJ files as assets
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
    // Proxy Replicate API requests to bypass CORS
    proxy: {
      '/api/replicate': {
        target: 'https://api.replicate.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the Authorization header
            const authHeader = req.headers['authorization'];
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader);
            }
          });
        },
      },
    },
  },
})
