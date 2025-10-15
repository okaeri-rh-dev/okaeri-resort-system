import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
  // Global ignores
  {
    ignores: [
      "dist/**/*",
      "build/**/*",
      "coverage/**/*",
      "node_modules/**/*",
      "test-results/**/*",
      "**/*.min.js",
      "**/*.bundle.js",
      "public/**/*",
      "scripts/**/*",
      ".wrangler/**/*", // Cloudflare Wrangler build artifacts
    ],
  },

  // Base configuration for JavaScript files
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
  },

  // TypeScript configuration - less strict
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended, // Only recommended, not strict
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React hooks rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // TypeScript rules - relaxed
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error
      "@typescript-eslint/no-non-null-assertion": "off", // Allow ! operator
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-ignore when needed
      "@typescript-eslint/no-inferrable-types": "off",

      // General JavaScript rules - relaxed
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-unused-vars": "off", // Using TypeScript's version
      "prefer-const": "warn",
      "no-var": "error",

      // Code style - very relaxed
      "max-len": "off", // No line length limit
      complexity: "off", // No complexity limit
      "max-lines-per-function": "off", // No function length limit
      "no-nested-ternary": "off", // Allow nested ternaries
      "no-param-reassign": "off", // Allow parameter reassignment
    },
  },

  // Test files - even more relaxed
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
]);
