import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config([
  // Global ignores
  {
    ignores: [
      "dist/**/*",
      "build/**/*",
      "coverage/**/*",
      "node_modules/**/*",
      ".next/**/*",
      ".vercel/**/*",
      "**/*.min.js",
      "**/*.bundle.js",
      "public/**/*",
      "docs/**/*",
      "*.config.js",
      "*.config.ts",
      "vite.config.ts",
      "vitest.config.ts",
    ],
  },

  // Base configuration for JavaScript files
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },

  // TypeScript configuration
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "19",
      },
    },
    rules: {
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],

      // TypeScript strict rules - no any types allowed
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
        },
      ],

      // Code quality rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "prefer-destructuring": [
        "error",
        {
          array: false,
          object: true,
        },
      ],

      // Performance and best practices
      "no-useless-computed-key": "error",
      "no-useless-rename": "error",
      "no-return-assign": "error",
      "no-param-reassign": "error",
      "no-nested-ternary": "error",
      complexity: ["warn", { max: 15 }],
      "max-depth": ["warn", { max: 4 }],
      "max-lines-per-function": [
        "warn",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },

  // Specific rules for test files
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // Specific rules for configuration files
  {
    files: ["**/*.config.{js,ts}", "**/vite.config.ts", "**/vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Security-specific rules - allow debugger in security token manager for suspicious activity detection
  {
    files: ["**/src/lib/security/secure-token-manager.ts"],
    rules: {
      "no-debugger": "off",
    },
  },
]);
