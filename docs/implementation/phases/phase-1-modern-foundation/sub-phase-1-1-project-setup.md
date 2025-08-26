# Sub-Phase 1.1: Project Setup & Configuration

## Overview

This sub-phase establishes the foundational development environment for the
Okaeri Resort Management System using Vite 7, React 19, and TypeScript. It sets
up all necessary tooling, configurations, and development workflows that will be
used throughout the project lifecycle.

## Objectives

1. Initialize a production-ready Vite 7 + React 19 + TypeScript project
2. Configure comprehensive development tooling (ESLint, Prettier, Husky)
3. Establish Git workflows and commit conventions
4. Setup environment configuration management
5. Create initial project structure following best practices

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.12.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "@vitejs/plugin-react-swc": "^4.0.0",
    "eslint": "^9.20.0",
    "eslint-config-prettier": "^10.0.0",
    "eslint-plugin-react": "^7.38.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.5.0",
    "husky": "^9.2.0",
    "lint-staged": "^16.0.0",
    "prettier": "^3.5.0",
    "typescript": "^5.7.0",
    "vite": "^7.0.0",
    "vitest": "^2.2.0"
  }
}
```

### TypeScript Configuration

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@stores/*": ["src/stores/*"],
      "@lib/*": ["src/lib/*"],
      "@api/*": ["src/api/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["@tanstack/react-query-devtools"],
  },
});
```

## Implementation Steps

### Step 1: Initialize Project

```bash
# Create project with Vite
pnpm create vite@latest okaeri-resort-system --template react-ts

# Navigate to project
cd okaeri-resort-system

# Install dependencies
pnpm install

# Install additional dev dependencies
pnpm add -D @types/node eslint-config-prettier eslint-plugin-react-refresh \
  husky lint-staged vitest @vitest/ui @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event
```

### Step 2: Configure ESLint

```javascript
// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      prettier,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  }
);
```

### Step 3: Configure Prettier

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "quoteProps": "as-needed"
}
```

### Step 4: Setup Git Hooks

```bash
# Initialize Husky
pnpm exec husky init

# Add pre-commit hook
echo "pnpm exec lint-staged" > .husky/pre-commit

# Add commit-msg hook for conventional commits
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

```json
// package.json additions
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### Step 5: Project Structure

```
okaeri-resort-system/
├── src/
│   ├── api/              # API client functions
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── layout/      # Layout components
│   │   └── features/    # Feature-specific components
│   ├── hooks/           # Custom React hooks
│   │   ├── queries/     # TanStack Query hooks
│   │   └── mutations/   # TanStack Mutation hooks
│   ├── lib/             # Utility functions
│   │   ├── utils.ts     # General utilities
│   │   └── constants.ts # App constants
│   ├── pages/           # Route pages
│   ├── stores/          # Zustand stores
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── api/                 # Vercel serverless functions
├── public/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── [config files]
```

## Type Definitions

### Base Types

```typescript
// src/types/global.d.ts
declare global {
  interface Window {
    __ORMS_VERSION__: string;
    __ORMS_ENV__: "development" | "staging" | "production";
  }
}

// src/types/common.ts
export type UUID = string;

export type Timestamp = string;

export type Currency = "PHP" | "USD" | "EUR";

export type BusinessType = "resort" | "restaurant" | "tour" | "retail";

export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}
```

## Test Requirements

### Unit Test Setup

```typescript
// vitest.config.ts
import { defineConfig, mergeConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineVitestConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: ["node_modules/", "tests/", "*.config.ts"],
        thresholds: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  })
);
```

### Test Examples

```typescript
// tests/unit/utils.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency, parseDate } from "@/lib/utils";

describe("Utility Functions", () => {
  describe("formatCurrency", () => {
    it("should format PHP currency correctly", () => {
      expect(formatCurrency(1000, "PHP")).toBe("₱1,000.00");
    });

    it("should handle zero amounts", () => {
      expect(formatCurrency(0, "PHP")).toBe("₱0.00");
    });
  });

  describe("parseDate", () => {
    it("should parse ISO date strings", () => {
      const date = parseDate("2025-01-25T00:00:00Z");
      expect(date).toBeInstanceOf(Date);
    });
  });
});
```

## Agent Validation Checklist

### tailwind-v4-design-expert Validation

- [ ] Tailwind CSS v4 properly configured with @theme directive
- [ ] CSS-first configuration using native CSS
- [ ] Lightning CSS integration working
- [ ] oklch() color space configured
- [ ] Design tokens properly defined
- [ ] Container queries enabled
- [ ] Custom utilities created
- [ ] PostCSS pipeline optimized

### typescript-react-quality-expert Validation

- [ ] TypeScript strict mode enabled with no `any` types
- [ ] All components properly typed with Props interfaces
- [ ] Consistent use of type imports
- [ ] No TypeScript errors or warnings
- [ ] Path aliases configured and working
- [ ] ESLint rules enforcing type safety
- [ ] Proper generic type usage where applicable
- [ ] Discriminated unions for complex state types

## Dependencies & Prerequisites

### System Requirements

- Node.js 20.19+ or 22.12+
- pnpm 9.0+
- Git 2.40+
- VS Code with recommended extensions

### VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Environment Variables

```bash
# .env.example
# Application
VITE_APP_NAME="Okaeri Resort Management System"
VITE_APP_VERSION="1.0.0"
VITE_APP_ENV="development"

# API Configuration
VITE_API_URL="http://localhost:3000/api"
VITE_API_TIMEOUT="30000"

# Feature Flags
VITE_FEATURE_ANALYTICS="false"
VITE_FEATURE_PWA="false"
```

## Deliverables

### Code Deliverables

- [ ] Initialized Vite 7 + React 19 + TypeScript project
- [ ] Complete ESLint and Prettier configuration
- [ ] Git hooks with Husky and lint-staged
- [ ] TypeScript configuration with strict mode
- [ ] Initial project structure created
- [ ] Environment configuration setup

### Documentation Deliverables

- [ ] README.md with setup instructions
- [ ] CONTRIBUTING.md with development guidelines
- [ ] Architecture Decision Records (ADRs) started
- [ ] VS Code workspace settings

### Validation Reports

- [ ] No ESLint errors or warnings
- [ ] No TypeScript compilation errors
- [ ] All type definitions in place
- [ ] Git hooks functioning correctly
- [ ] Build process successful

## Success Criteria

1. **Development Environment** - Project runs with `pnpm dev` without errors
2. **Type Safety** - TypeScript strict mode with zero `any` types
3. **Code Quality** - ESLint and Prettier configured with no violations
4. **Git Workflow** - Commits follow conventional format with pre-commit checks
5. **Build Process** - Production build completes successfully
6. **Performance** - Dev server starts in < 1 second

## Risk Mitigation

### Identified Risks

1. **React 19 Breaking Changes**
   - Monitor React 19 changelog
   - Test all new features thoroughly
   - Have React 18.3 fallback plan

2. **Vite 7 Compatibility**
   - Verify all plugins support Vite 7
   - Test build output thoroughly
   - Monitor for performance regressions

3. **TypeScript Strictness**
   - Start with strict mode from beginning
   - Document type patterns early
   - Provide team training on advanced TypeScript

## Completion Checklist

- [ ] All dependencies installed and versions locked
- [ ] TypeScript configuration complete with strict mode
- [ ] ESLint and Prettier working with no errors
- [ ] Git hooks operational and tested
- [ ] Project structure created as specified
- [ ] Environment variables configured
- [ ] Initial build and dev server tested
- [ ] Agent validation passed
- [ ] Documentation complete
- [ ] Handoff to Sub-Phase 1.2 ready

---

_Sub-Phase 1.1 establishes the critical development foundation. Proper
completion ensures smooth development throughout the project lifecycle._
