import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare/OpenNext output and local state. Linting these used to make
    // `npm run lint` exhaust the Node heap on a fresh checkout.
    ".open-next/**",
    ".wrangler/**",
    // Regenerable build artefacts (Hardhat/TypeChain).
    "artifacts/**",
    "cache/**",
    "typechain-types/**",
    "coverage/**",
    // Static assets are not linted.
    "public/**",
    // One-off operational scripts use `any` by design when talking to the RPC.
    "scripts/**",
  ]),
  {
    rules: {
      // These two rules ship with React Compiler's lint preset. The codebase
      // intentionally hydrates mount-only state and mirrors async query
      // results into local state in a handful of components; the patterns are
      // correct but not compiler-optimisable. Surfacing them as warnings keeps
      // `npm run lint` green for CI while still reporting new violations.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
