import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Architecture rules: each maps to a shipped bug. See docs/plans/2026-10-03-guardrails-design.md.
// no-restricted-syntax options do not merge across config blocks, so every block that sets it
// must list all the selectors that apply to its files.
const metadataRoleSelector = {
  selector:
    "MemberExpression[object.property.name=/^(user_metadata|app_metadata|raw_user_meta_data)$/][property.name='role']",
  message:
    "user_metadata is user-editable (supabase.auth.updateUser). Read roles from app_roles: lookupUserRole/requireRole on the server, getUserAuditRole in the app.",
};

const silentCatchSelector = {
  selector:
    "CatchClause > BlockStatement[body.length=1] > ExpressionStatement > CallExpression[callee.object.name='console'][callee.property.name='error']",
  message:
    "A catch that only logs hides the failure from the user (a broken payment upload went unnoticed this way). Show a toast, rethrow, or return an error state.",
};

const untypedPayloadSelector = {
  selector:
    "CallExpression[callee.property.name=/^(insert|update|upsert)$/][callee.object.callee.property.name='from'] > ObjectExpression.arguments:first-child",
  message:
    'Add `satisfies TablesInsert<"table">` (or TablesUpdate) from @/types/database.types. The typed client does not reject unknown columns in a payload (ab11f54 inserted columns payments never had).',
};

const utcDateSliceSelector = {
  selector:
    "CallExpression[callee.property.name=/^(split|slice|substring)$/][callee.object.callee.property.name='toISOString']",
  message:
    "toISOString() is UTC, so a local date before 08:00 Manila time becomes the previous day. Use toISODateString() from @/lib/timezone.",
};

// Type-aware rules need a TS program per file (~4x slower), so the per-edit hook, Stop hook
// and pre-commit set ESLINT_TYPE_AWARE=off. CI, `npm run lint` and pre-push run them.
const typeAware = process.env.ESLINT_TYPE_AWARE !== "off";

const generatedDatabaseTypesPattern = {
  group: ["**/database.generated"],
  message:
    "Import from @/types/database.types, which narrows CHECK-constrained columns such as booking_status.",
};

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
      ".claude/worktrees/**/*", // agent worktrees are full repo copies
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
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-ignore when needed
      "@typescript-eslint/no-inferrable-types": "off",

      // General JavaScript rules - relaxed
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-unused-vars": "off", // Using TypeScript's version
      "prefer-const": "warn",
      "no-var": "error",
      "no-restricted-syntax": ["error", metadataRoleSelector, untypedPayloadSelector],

      // Code style - very relaxed
      "max-len": "off", // No line length limit
      complexity: "off", // No complexity limit
      "max-lines-per-function": "off", // No function length limit
      "no-nested-ternary": "off", // Allow nested ternaries
      "no-param-reassign": "off", // Allow parameter reassignment
    },
  },

  // Warn until each rule's fix batch lands, then error (guardrails Phase 3).
  // tsconfig.eslint.json covers the tests and root configs that tsconfig.json excludes.
  ...(typeAware
    ? [
        {
          files: ["**/*.{ts,tsx}"],
          languageOptions: {
            parserOptions: {
              project: [
                "./tsconfig.eslint.json",
                "./functions/tsconfig.json",
                "./tsconfig.e2e.json",
              ],
              tsconfigRootDir: import.meta.dirname,
            },
          },
          rules: {
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/no-floating-promises": [
              "warn",
              {
                // Neither rejects: invalidate/refetch default to throwOnError false,
                // and the router reports navigation errors itself.
                allowForKnownSafeCalls: [
                  {
                    from: "package",
                    package: "@tanstack/query-core",
                    name: ["invalidateQueries", "refetchQueries"],
                  },
                  { from: "package", package: "@tanstack/router-core", name: "navigate" },
                ],
              },
            ],
            "@typescript-eslint/no-misused-promises": [
              "error",
              { checksVoidReturn: { attributes: false } },
            ],
            "@typescript-eslint/no-unnecessary-type-assertion": "warn",
          },
        },
      ]
    : []),

  // Test files - even more relaxed
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
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

  {
    files: ["**/__tests__/**/*.{ts,tsx}", "src/test/**/*.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/types/database.types.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [generatedDatabaseTypesPattern] },
      ],
    },
  },

  // The service-role client bypasses RLS and must never reach the browser bundle
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/types/database.types.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            generatedDatabaseTypesPattern,
            {
              group: ["@/lib/supabase-admin", "**/lib/supabase-admin"],
              allowTypeImports: true,
              message:
                "supabase-admin uses the service-role key, which bypasses RLS. It belongs in functions/ only.",
            },
          ],
        },
      ],
    },
  },

  // UI handlers must surface failures, not just log them
  {
    files: ["src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    ignores: ["**/*.phase3-4.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        metadataRoleSelector,
        untypedPayloadSelector,
        silentCatchSelector,
      ],
    },
  },

  // Components and routes read data through hooks and stores (warn until existing imports move)
  {
    files: ["src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/lib/supabase", "**/lib/supabase"],
              importNames: ["supabase"],
              message:
                "Query through a hook, store, or the typed db helpers so data access stays in one layer.",
            },
          ],
        },
      ],
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
        metadataRoleSelector,
        untypedPayloadSelector,
        silentCatchSelector,
        utcDateSliceSelector,
      ],
    },
  },

  // Tests insert deliberately invalid rows (constraint tests), so payloads stay unannotated
  {
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "src/test/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": ["error", metadataRoleSelector],
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
