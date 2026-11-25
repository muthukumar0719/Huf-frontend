import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// RM app runs on 5173; the client app on 5174 (matches CLIENT_APP_URL).
export default defineConfig({
  plugins: [react()],
  base: "/huf/",
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
