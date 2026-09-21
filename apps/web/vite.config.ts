import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.PACT_WEB_BASE_PATH ?? "/",
  plugins: [react()],
  server: { port: 5173 },
});
