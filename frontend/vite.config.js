import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 프론트: 4699, 백엔드 API: 4700 (프록시)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4699,
    proxy: {
      "/api": {
        target: "http://localhost:4700",
        changeOrigin: true,
      },
    },
  },
});
