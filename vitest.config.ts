import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Sans include explicite, Vitest ramasse aussi *.spec.ts par defaut - or
    // e2e/*.spec.ts est le domaine de Playwright (smoke navigateur reel),
    // pas de Vitest (jsdom). Restreint aux tests unitaires sous src/.
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // json-summary : consomme par vitest-coverage-report-action (commentaire de PR)
      reporter: ["text", "html", "lcov", "json", "json-summary"],
      include: ["src/lib/**", "src/services/**"],
      exclude: [
        // Wrappers fins autour de SDK externes : verifies par test
        // d'integration manuel (scripts jetables contre l'infra reelle),
        // pas par unit test - mocker tout le SDK n'apporterait rien.
        "src/lib/queue/pg-boss-adapter.ts",
        "src/lib/storage/s3-adapter.ts",
        "src/lib/auth.ts",
        // Composition root (une seule ligne : instancier l'adaptateur reel
        // depuis les env vars) - meme justification que ci-dessus.
        "src/lib/queue/index.ts",
        "src/lib/storage/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
