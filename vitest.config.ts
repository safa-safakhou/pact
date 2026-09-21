import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "services/**/*.test.ts",
      "workers/**/*.test.ts",
      "tests/unit/**/*.test.ts",
    ],
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
