import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        zhidu: resolve(__dirname, "zhidu.html"),
        sixiang: resolve(__dirname, "sixiang.html"),
        tianxia: resolve(__dirname, "tianxia.html"),
        wenyi: resolve(__dirname, "wenyi.html"),
        riyong: resolve(__dirname, "riyong.html"),
        baigong: resolve(__dirname, "baigong.html"),
        kaogu: resolve(__dirname, "kaogu.html"),
      },
    },
  },
});
