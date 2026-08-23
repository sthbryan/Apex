import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("/node_modules/preact") || id.includes("/node_modules/@preact/")) {
            return "preact";
          }
          if (id.includes("/node_modules/@xterm/")) {
            return "xterm";
          }
          if (id.includes("/node_modules/highlight.js")) {
            return "highlight";
          }
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
