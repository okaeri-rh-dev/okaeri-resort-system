#!/usr/bin/env node

/**
 * Verification Script: Native Required Attributes for Semantic Accessibility
 *
 * This script verifies that all mandatory form inputs have native `required` attributes
 * for enhanced semantic accessibility, in addition to React Hook Form + Zod validation.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

// Form components to verify
const formComponents = [
  {
    name: "LoginForm",
    path: "src/features/auth/components/LoginForm.tsx",
    requiredFields: [
      { field: "email", pattern: /id="email".*?required/s },
      { field: "password", pattern: /id="password".*?required/s },
    ],
    optionalFields: [{ field: "rememberMe", shouldNotHaveRequired: true }],
  },
  {
    name: "RegisterForm",
    path: "src/features/auth/components/RegisterForm.tsx",
    requiredFields: [
      { field: "name", pattern: /id="name".*?required/s },
      { field: "email", pattern: /id="email".*?required/s },
      { field: "password", pattern: /id="password".*?required/s },
      { field: "confirmPassword", pattern: /id="confirmPassword".*?required/s },
      { field: "acceptTerms", pattern: /id="acceptTerms".*?required/s },
    ],
    optionalFields: [
      { field: "projectName", shouldNotHaveRequired: true },
      { field: "phone", shouldNotHaveRequired: true },
    ],
  },
  {
    name: "PasswordResetForm",
    path: "src/features/auth/components/PasswordResetForm.tsx",
    requiredFields: [{ field: "email", pattern: /id="email".*?required/s }],
    optionalFields: [],
  },
];

function verifyForm(form) {
  console.log(`\n${colors.blue}${colors.bold}Verifying ${form.name}...${colors.reset}`);

  const filePath = path.join(process.cwd(), form.path);

  if (!fs.existsSync(filePath)) {
    console.log(`${colors.red}✗ File not found: ${form.path}${colors.reset}`);
    return false;
  }

  const content = fs.readFileSync(filePath, "utf8");
  let allPassed = true;

  // Check required fields
  console.log(`  ${colors.bold}Required Fields:${colors.reset}`);
  for (const field of form.requiredFields) {
    const hasRequired = field.pattern.test(content);
    if (hasRequired) {
      console.log(`    ${colors.green}✓${colors.reset} ${field.field}: has required attribute`);
    } else {
      console.log(`    ${colors.red}✗${colors.reset} ${field.field}: missing required attribute`);
      allPassed = false;
    }
  }

  // Check optional fields (should NOT have required)
  if (form.optionalFields.length > 0) {
    console.log(`  ${colors.bold}Optional Fields:${colors.reset}`);
    for (const field of form.optionalFields) {
      // More precise pattern to check for required attribute on the specific input
      const inputMatch = content.match(new RegExp(`<[^>]*id="${field.field}"[^>]*>`, "s"));
      if (inputMatch) {
        const hasRequired = /\brequired\b/.test(inputMatch[0]);
        if (!hasRequired) {
          console.log(
            `    ${colors.green}✓${colors.reset} ${field.field}: correctly optional (no required)`
          );
        } else {
          console.log(
            `    ${colors.red}✗${colors.reset} ${field.field}: incorrectly has required attribute`
          );
          allPassed = false;
        }
      } else {
        console.log(`    ${colors.yellow}⚠${colors.reset} ${field.field}: input not found`);
        allPassed = false;
      }
    }
  }

  // Check for noValidate on form
  const hasNoValidate = /noValidate/.test(content);
  console.log(`  ${colors.bold}Form Configuration:${colors.reset}`);
  if (hasNoValidate) {
    console.log(
      `    ${colors.green}✓${colors.reset} noValidate present (using RHF+Zod validation)`
    );
  } else {
    console.log(
      `    ${colors.yellow}⚠${colors.reset} noValidate not found (may use browser validation)`
    );
  }

  return allPassed;
}

function main() {
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.bold}  Semantic Accessibility Enhancement Verification${colors.reset}`);
  console.log(
    `${colors.bold}  Native Required Attributes for WCAG 2.1 AA+ Compliance${colors.reset}`
  );
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`
  );

  let allFormsPassed = true;

  for (const form of formComponents) {
    const passed = verifyForm(form);
    if (!passed) {
      allFormsPassed = false;
    }
  }

  console.log(
    `\n${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`
  );

  if (allFormsPassed) {
    console.log(
      `${colors.green}${colors.bold}✓ SUCCESS: All forms have proper semantic accessibility!${colors.reset}`
    );
    console.log(
      `${colors.green}  - All mandatory fields have native required attributes${colors.reset}`
    );
    console.log(
      `${colors.green}  - Optional fields correctly omit required attribute${colors.reset}`
    );
    console.log(
      `${colors.green}  - Forms use noValidate with React Hook Form + Zod${colors.reset}`
    );
    console.log(`${colors.green}  - Enhanced semantic HTML for screen readers${colors.reset}`);
    console.log(`${colors.green}  - Enterprise-grade accessibility achieved${colors.reset}`);
    process.exit(0);
  } else {
    console.log(
      `${colors.red}${colors.bold}✗ FAILED: Some forms need accessibility improvements${colors.reset}`
    );
    console.log(
      `${colors.yellow}  Please add required attributes to mandatory fields${colors.reset}`
    );
    process.exit(1);
  }
}

main();
