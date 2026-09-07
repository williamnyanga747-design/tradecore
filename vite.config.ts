import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'prompt',
      // Custom Service Worker (injectManifest) so we can attach setCatchHandler() and
      // a NetworkFirst-with-timeout navigation route directly in public/sw.ts. This is
      // the only way to guarantee a failed navigation fetch returns the cached
      // index.html instead of an unhandled "Failed to fetch" Promise rejection.
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'offline.html'],
      manifest: {
        name: "Universal's All-in-One Business & Wholesale Trading Platform",
        short_name: "Universal Trading",
        description: "POS, FIFO stock control, financial reports and a public storefront marketplace for every Tanzanian business.",
        theme_color: "#f59e0b",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        categories: ["shopping", "business"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      // In injectManifest mode the precache globs + size limits go under `injectManifest`
      // (NOT `workbox`, which injectManifest ignores). The main bundle exceeds the default
      // 2 MiB precache limit, so we must raise maximumFileSizeToCacheInBytes here or the
      // index chunk is silently dropped from the precache manifest.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['**/sw.js', '**/sw.mjs', '**/workbox-*.js', '**/server.cjs*'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false }
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-lucide': ['lucide-react'],
            'vendor-motion': ['motion/react'],
            'vendor-recharts': ['recharts'],
            'vendor-pdf': ['jspdf'],
          },
        },
      },
    },
  };
});
