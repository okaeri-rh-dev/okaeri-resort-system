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
      // React hooks rules (v6 recommended-latest with React Compiler diagnostics)
      ...reactHooks.configs["recommended-latest"].rules,
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

  // Test helper files (mocks, handlers, setup files)
  {
    files: ["__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // Date-only values must use the local (Asia/Manila) calendar day. toISOString() is UTC,
  // so a date picked at local midnight becomes the previous day. Scope widens in
  // guardrails Phase 1 (docs/plans/2026-10-03-guardrails-design.md).
  {
    files: ["src/components/expenses/**/*.{ts,tsx}", "src/stores/useExpenseStore.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(split|slice|substring)$/][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC, so a local date before 08:00 Manila time becomes the previous day. Use toISODateString() from @/lib/timezone.",
        },
      ],
    },
  },

  // Load testing scripts (k6) - allow console.log for test output
  {
    files: ["load-testing/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);
