import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "src/generated/**",
    // Sorties locales de sessions Claude (scripts de generation de livrables),
    // deja ignorees par git (.gitignore "Claude outputs/") : jamais du code
    // du produit, ne doivent pas faire rougir le lint local.
    "**/Claude outputs/**",
  ]),
]);

export default eslintConfig;
