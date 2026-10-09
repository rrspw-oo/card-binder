import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/card-binder/",
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
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(tesseract|@tesseract)/,
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-cache",
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
