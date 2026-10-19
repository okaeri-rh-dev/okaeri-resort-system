import js from "@eslint/js";
import pluginQuery from "@tanstack/eslint-plugin-query";
import betterTailwind from "eslint-plugin-better-tailwindcss";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { builtinRules } from "eslint/use-at-your-own-risk";
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
    "toISOString() is UTC, so before 08:00 Manila time it gives the previous day. From @/lib/timezone use toManilaDateString() for today or a timestamp, toISODateString() for a picked date, or toUTCDateString() when the key must follow UTC days (Cloudflare quotas).",
};

const dangerousHtmlSelector = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message:
    "React escapes rendered values; dangerouslySetInnerHTML skips that. Render text or elements instead. If raw HTML is unavoidable, sanitize it with sanitizeRichText from @/lib/security/sanitize and disable this line with the reason.",
};

// Type-aware rules need a TS program per file (~4x slower), so the per-edit hook, Stop hook
// and pre-commit set ESLINT_TYPE_AWARE=off. CI, `npm run lint` and pre-push run them.
const typeAware = process.env.ESLINT_TYPE_AWARE !== "off";

const generatedDatabaseTypesPattern = {
  group: ["**/database.generated"],
  message:
    "Import from @/types/database.types, which narrows CHECK-constrained columns such as booking_status.",
};

const arbitraryColourMessage =
  "Arbitrary colour: use a semantic token class such as bg-primary or text-muted-foreground (DESIGN.md, Colour).";

// Each slice of the design foundations adds its classes here (DESIGN.md enforcement map).
const restrictedClasses = [
  {
    pattern:
      "^(?:.*:)?-?[a-z-]+-\\[(?:color:|#|(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix|color)\\().*\\](?:\\/.*)?$",
    message: arbitraryColourMessage,
  },
  {
    pattern:
      "^(?:.*:)?\\[(?:color|background|background-color|border(?:-[a-z]+)?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color):.*\\]$",
    message: arbitraryColourMessage,
  },
];

// no-restricted-syntax again under its own id, so design suppressions are counted apart from the
// guardrail selectors above and a legacy file can't trade one for the other.
const designPlugin = {
  rules: { "no-restricted-syntax": builtinRules.get("no-restricted-syntax") },
};

const transitionAllMessage =
  "transition-all animates layout and colour together; list the properties (transition-colors, transition-opacity) with duration-150.";
const focusRingMessage =
  "focus: shows rings on mouse clicks; use focus-visible: so rings appear only for keyboard focus.";

const classStringSelectors = (regex, message) => [
  { selector: `Literal[value=/${regex}/]`, message },
  { selector: `TemplateElement[value.raw=/${regex}/]`, message },
];

const designSyntaxSelectors = [
  ...classStringSelectors("(^|\\s)([\\w-]+:)*!?transition-all!?(\\s|$)", transitionAllMessage),
  ...classStringSelectors("(^|\\s)([\\w-]+:)*focus:(ring|outline)", focusRingMessage),
  {
    selector:
      "JSXOpeningElement[name.name='img']:matches(:not(:has(JSXAttribute[name.name='width'])), :not(:has(JSXAttribute[name.name='height'])))",
    message:
      "Give <img> width and height so the browser reserves its space and the layout doesn't shift as it loads.",
  },
];

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
      "@tanstack/query": pluginQuery,
    },
    rules: {
      // React hooks rules (v6 recommended-latest with React Compiler diagnostics)
      ...reactHooks.configs["recommended-latest"].rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // TanStack Query recommended set (exhaustive-deps found a query that failed before the token loaded)
      ...Object.fromEntries(
        Object.keys(pluginQuery.configs["flat/recommended"][0].rules).map((rule) => [rule, "error"])
      ),
      // Keys live in queryOptions factories (src/lib/query-keys.ts); misses clients not from useQueryClient()
      "@tanstack/query/prefer-query-options": "error",

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
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-ignore when needed
      "@typescript-eslint/no-inferrable-types": "off",

      // General JavaScript rules - relaxed
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-unused-vars": "off", // Using TypeScript's version
      "prefer-const": "warn",
      "no-var": "error",
      "no-restricted-syntax": [
        "error",
        metadataRoleSelector,
        untypedPayloadSelector,
        utcDateSliceSelector,
        dangerousHtmlSelector,
      ],

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
              // First match wins, so each file gets the program tsc checks it with;
              // tsconfig.eslint.json is the fallback for files tsc does not check.
              project: [
                "./tsconfig.json",
                "./functions/tsconfig.json",
                "./tsconfig.e2e.json",
                "./tsconfig.eslint.json",
              ],
              tsconfigRootDir: import.meta.dirname,
            },
          },
          rules: {
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/no-floating-promises": [
              "error",
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
            // Off: it calls `(await res.json()) as T` redundant because the cast itself
            // infers json<T>(); removing it breaks tsc (88 of 124 hits, guardrails Phase 3).
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
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
        utcDateSliceSelector,
        dangerousHtmlSelector,
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

  // shadcn primitives export variants beside components; kept as generated (also excluded in knip.json)
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
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

  // Design rules (DESIGN.md enforcement map). Legacy violations live in eslint-suppressions.json.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwind, design: designPlugin, "jsx-a11y": jsxA11y },
    settings: {
      "better-tailwindcss": { entryPoint: "src/index.css" },
      "jsx-a11y": { components: { Button: "button", Label: "label", Link: "a" } },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Router Link renders its href from `to`
      "jsx-a11y/anchor-is-valid": ["error", { specialLink: ["to"] }],
      "better-tailwindcss/no-restricted-classes": ["error", { restrict: restrictedClasses }],
      "design/no-restricted-syntax": ["error", ...designSyntaxSelectors],
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
