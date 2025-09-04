#!/usr/bin/env node

/**
 * Fix remaining ESLint violations in auth test files
 * Specifically targets test callback parameters
 */

import fs from 'fs';
import { globSync } from 'glob';

const files = [
  'src/features/auth/__tests__/PasswordResetForm.test.tsx',
  'src/features/auth/__tests__/RegistrationForm.test.tsx'
];

files.forEach(file => {
  console.log(`Fixing: ${file}`);
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix test callback parameters - more comprehensive pattern
  content = content.replace(
    /it\.todo\("([^"]+)",\s*\(([^)]+)\)\s*=>/g,
    (match, testName, params) => {
      // Replace all parameters with underscore prefix
      const fixedParams = params.split(',').map(param => {
        const trimmed = param.trim();
        if (trimmed && !trimmed.startsWith('_')) {
          return '_' + trimmed;
        }
        return trimmed;
      }).join(', ');
      return `it.todo("${testName}", (${fixedParams}) =>`;
    }
  );
  
  // Fix describe callback parameters
  content = content.replace(
    /describe\.each\([^)]*\)\("([^"]+)",\s*\(([^)]+)\)\s*=>/g,
    (match, testName, params) => {
      const fixedParams = params.split(',').map(param => {
        const parts = param.split(':');
        if (parts.length === 2) {
          const varName = parts[0].trim();
          const type = parts[1].trim();
          if (!varName.startsWith('_')) {
            return `_${varName}: ${type}`;
          }
        }
        return param;
      }).join(', ');
      return `describe.each([...])("${testName}", (${fixedParams}) =>`;
    }
  );
  
  fs.writeFileSync(file, content);
  console.log(`  ✓ Fixed`);
});

console.log('\n✅ Fixed remaining auth test violations');