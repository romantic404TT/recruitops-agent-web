import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * 端口说明：本机长期有多个 Vite dev server 并存（5173 / 5180 / 5188 / 5190 / 5199 / 5320 …），
 * 静默顺延会导致浏览器验收时误测到邻居项目。这里钉死 5330（dev）/ 4330（preview）
 * 并开启 strictPort，让端口冲突变成显式失败而不是悄悄换端口。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5330,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4330,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
