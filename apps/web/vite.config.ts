import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.PACT_WEB_BASE_PATH ?? "/",
  plugins: [react()],
  server: {
    port: 5173,
    ...(process.env.PACT_API_PROXY ? { proxy: { "/v1": process.env.PACT_API_PROXY } } : {}),
  },
});
