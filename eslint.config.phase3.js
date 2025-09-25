import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Phase 3 ESLint Configuration - Code Quality Standards
 *
 * This configuration enforces strict code quality standards including:
 * - Component size limits (300 lines max)
 * - Function complexity limits
 * - Proper useEffect cleanup
 * - No any types
 * - Consistent code organization
 */
export default tseslint.config([
  // Global ignores
  {
    ignores: [
      "dist/**/*",
      "build/**/*",
      "coverage/**/*",
      "node_modules/**/*",
      "**/*.min.js",
      "**/*.bundle.js",
      "public/**/*",
      "src/examples/**/*", // Ignore examples
      "*.phase3-4.*", // Ignore phase 3-4 deferred files
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

  // TypeScript configuration - STRICT for Phase 3
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strict, // Using strict instead of recommended
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
      // ========================================
      // PHASE 3: Code Quality Rules
      // ========================================

      // Component size enforcement
      "max-lines": [
        "error",
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // Function complexity
      complexity: ["error", 15], // Max cyclomatic complexity of 15
      "max-depth": ["error", 4], // Max nesting depth of 4
      "max-nested-callbacks": ["error", 3],
      "max-params": ["warn", 5], // Warn if more than 5 params

      // React hooks rules - STRICT
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error", // Require all dependencies

      // React Refresh
      "react-refresh/only-export-components": [
        "error", // Error instead of warn
        { allowConstantExport: true },
      ],

      // ========================================
      // TypeScript Rules - STRICT
      // ========================================

      // No any types allowed
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // Require explicit return types for public APIs
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

      // Consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Unused variables
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Naming conventions
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "interface",
          format: ["PascalCase"],
          prefix: ["I"], // Interfaces should start with I
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "enum",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
      ],

      // ========================================
      // General JavaScript Rules
      // ========================================

      // No console in production code
      "no-console": [
        "error",
        {
          allow: ["warn", "error", "info"],
        },
      ],

      // No debugger
      "no-debugger": "error",

      // Require const
      "prefer-const": "error",
      "no-var": "error",

      // Promise handling
      "no-async-promise-executor": "error",
      "no-await-in-loop": "warn",
      "require-await": "error",

      // Error handling
      "no-throw-literal": "error",

      // Code organization
      "no-duplicate-imports": "error",
      "sort-imports": [
        "warn",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true, // Let import/order handle this
        },
      ],

      // Best practices
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "error",
      "no-useless-return": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",

      // ========================================
      // Phase 3 Specific: useEffect Cleanup
      // ========================================

      // Custom rule patterns for useEffect cleanup
      // These would need custom ESLint rules or manual review
      // For now, exhaustive-deps helps ensure proper cleanup
    },
  },

  // Components directory - even stricter
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 250, // Stricter for components
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", 10], // Lower complexity for components
    },
  },

  // Hooks directory - specific rules
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    rules: {
      // Hooks must start with 'use'
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "function",
          format: ["camelCase"],
          leadingUnderscore: "forbid",
          custom: {
            regex: "^use[A-Z]",
            match: true,
          },
        },
      ],
    },
  },

  // Pattern files - allow examples
  {
    files: ["src/patterns/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", 400], // More lenient for pattern files
    },
  },

  // Test files - relaxed
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "max-lines": "off",
      complexity: "off",
      "no-console": "off",
    },
  },

  // Migration/temporary files - very relaxed
  {
    files: ["**/*.old.{ts,tsx}", "**/*.backup.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "max-lines": "off",
      complexity: "off",
    },
  },
]);
