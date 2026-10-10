import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/card-binder/",
  worker: { format: "es" },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/card-binder\/models\//,
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-models",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@/,
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-runtime",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Card Binder",
        short_name: "Card Binder",
        description: "拍照整理自己的寶可夢卡牌收藏",
        theme_color: "#fafafa",
        background_color: "#fafafa",
        display: "standalone",
        orientation: "portrait",
        scope: "/card-binder/",
        start_url: "/card-binder/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    }),
  ],
});
