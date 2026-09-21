import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ base: process.env.PACT_TELEGRAM_BASE_PATH ?? "/", plugins: [react()] });
