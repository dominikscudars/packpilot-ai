import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  resolve: { dedupe: ["zod", "decimal.js"] },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "supabase", test: /node_modules\/@supabase/ },
            { name: "validation", test: /node_modules\/zod/ },
          ],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    css: false,
  },
});
