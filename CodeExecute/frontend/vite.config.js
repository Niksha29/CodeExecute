import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHosts = [
  "localhost",
  "127.0.0.1",
  "822d3b36-43be-4353-9da7-4a41727cdf62-00-1l81mec9x3bjp.pike.replit.dev",
  "c1ad3f31-c2e1-4f4a-b723-c4275c8fad5a-00-336ijj0remvzb.sisko.replit.dev",
];
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: process.env.PORT || 5173,
    allowedHosts,
  },
});
