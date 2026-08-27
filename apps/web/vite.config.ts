import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": { target: "http://localhost:3001", changeOrigin: true },
      "/me": { target: "http://localhost:3001", changeOrigin: true },
      "/games": { target: "http://localhost:3001", changeOrigin: true },
      "/matchmaking": { target: "http://localhost:3001", changeOrigin: true },
      "/health": { target: "http://localhost:3001", changeOrigin: true },
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
