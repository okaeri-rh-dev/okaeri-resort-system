#!/usr/bin/env node

/**
 * Script to fix ESLint violations in auth test files
 * Addresses unused variables by prefixing with underscore
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Patterns to fix
const patterns = [
  // Unused function parameters in test callbacks
  {
    pattern: /(\w+): (requirement|feature|policy|element|path|field|error|email)\)/g,
    replacement: "_$1: $2)",
  },

  // Common unused variable assignments
  { pattern: /const user = userEvent\.setup\(\)/g, replacement: "const _user = userEvent.setup()" },
  {
    pattern:
      /const (philippineEmails|philippineTestData|mockProps|validEmail|expiredToken|invalidToken|strongPassword|weakPassword|mockAuthService) =/g,
    replacement: "const _$1 =",
  },

  // Unused imports from test utils (comment them out)
  {
    pattern:
      /^import \{ ([^}]*(?:screen|waitFor|fireEvent|renderWithProviders|MOCK_AUTH_STATES|TEST_IDS|formHelpers|checkA11y|philippineTestData|securityHelpers|performanceHelpers|MOCK_USERS|renderWithRouter|createTestRouter|MOCK_USER_ROLES)[^}]*) \}/gm,
    replacement: (match) => "// " + match,
  },

  // Unused imports but needed for types
  { pattern: /^import \{ axe \} from/gm, replacement: "// import { axe } from" },
  { pattern: /^import \{ within \} from/gm, replacement: "// import { within } from" },

  // Mock function variables
  {
    pattern: /const (mockLoginForm|mockRegisterForm|mockPasswordResetForm) =/g,
    replacement: "const _$1 =",
  },

  // Router mock parameters
  {
    pattern: /createFileRoute: vi\.fn\(\(path: string\)/g,
    replacement: "createFileRoute: vi.fn((_path: string)",
  },

  // Other common unused vars
  { pattern: /(\s+)const (user|mockProps) = /g, replacement: "$1const _$2 = " },
];

function fixFile(filePath) {
  console.log(`Fixing: ${filePath}`);
  let content = fs.readFileSync(filePath, "utf8");
  let changesMade = false;

  patterns.forEach(({ pattern, replacement }) => {
    const originalContent = content;
    if (typeof replacement === "function") {
      content = content.replace(pattern, replacement);
    } else {
      content = content.replace(pattern, replacement);
    }
    if (originalContent !== content) {
      changesMade = true;
    }
  });

  if (changesMade) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ Fixed violations`);
  } else {
    console.log(`  - No changes needed`);
  }
}

// Find all test files in auth directory
const authTestFiles = glob.sync("src/features/auth/**/*.test.tsx");
const authSimpleTestFiles = glob.sync("src/features/auth/**/*.simple.test.tsx");

const allTestFiles = [...authTestFiles, ...authSimpleTestFiles];
console.log(`Found ${allTestFiles.length} test files to process\n`);

allTestFiles.forEach(fixFile);

console.log("\n✅ ESLint fixes applied to auth test files");
console.log('Run "npm run lint" to check remaining violations');
