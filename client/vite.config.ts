import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SharedNotes',
        short_name: 'Notes',
        description: 'Your notes, quietly in sync.',
        theme_color: '#181817',
        background_color: '#181817',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: /\/notes|\/auth/,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', networkTimeoutSeconds: 4, expiration: { maxEntries: 80, maxAgeSeconds: 86400 } }
        }]
      }
    })
  ],
  server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }
});
