import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: "client/assets",
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      phaser3spectorjs: resolve("client/shims/phaser3spectorjs.js"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return null;
          }

          if (id.includes("node_modules/phaser")) {
            return "phaser-vendor";
          }

          if (id.includes("node_modules/socket.io-client")) {
            return "network-vendor";
          }

          return "app-vendor";
        },
      },
    },
  },
});