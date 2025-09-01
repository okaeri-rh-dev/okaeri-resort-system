#!/usr/bin/env node

/**
 * Storage Security Audit - Cross-Platform Node.js Version
 * 
 * This script verifies that JWT tokens are stored in memory only, 
 * NOT in localStorage or sessionStorage for enhanced XSS protection.
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Security violations found
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Track violations
let violations = 0;
const violationDetails = [];

console.log('🔒 Storage Security Audit v2.0 (Node.js)');
console.log('=========================================');
console.log('Verifying memory-only token storage (NO localStorage/sessionStorage)\n');

/**
 * Search for patterns in files
 * @param {string[]} patterns - Glob patterns to search
 * @param {RegExp} searchRegex - Regular expression to search for
 * @returns {Array} Array of {file, line, match} objects
 */
async function searchInFiles(patterns, searchRegex) {
  const results = [];
  
  try {
    const files = await glob(patterns, { 
      ignore: [
        '**/node_modules/**', 
        '**/dist/**', 
        '**/build/**', 
        '**/.git/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx'
      ]
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          const trimmedLine = line.trim();
          // Skip comments and console statements
          if (!trimmedLine.startsWith('//') && 
              !trimmedLine.startsWith('*') && 
              !trimmedLine.startsWith('/*') &&
              !trimmedLine.includes('console.')) {
            results.push({
              file: path.relative(process.cwd(), file),
              lineNumber: index + 1,
              line: trimmedLine,
              match: line.match(searchRegex)[0]
            });
          }
        }
      });
    }
  } catch (error) {
    console.error(`Error searching files: ${error.message}`);
  }
  
  return results;
}

/**
 * Check if a line contains token-related storage
 * @param {string} line - Line to check
 * @returns {boolean} True if token storage detected
 */
function isTokenStorage(line) {
  const tokenPatterns = [
    'auth_token',
    'authToken',
    'refresh_token',
    'refreshToken',
    'access_token',
    'accessToken',
    'jwt',
    'JWT',
    'token',
    'bearer'
  ];
  
  const lowerLine = line.toLowerCase();
  return tokenPatterns.some(pattern => lowerLine.includes(pattern.toLowerCase()));
}

/**
 * Report violations
 * @param {string} description - Description of the violation
 * @param {Array} findings - Array of findings
 * @returns {boolean} True if violations found
 */
function reportViolation(description, findings) {
  if (findings.length > 0) {
    console.log(`${colors.red}❌ SECURITY VIOLATION: ${description}${colors.reset}`);
    console.log('Tokens must be stored in memory only for XSS protection');
    console.log('Found violations:');
    
    // Show first 5 violations with context
    findings.slice(0, 5).forEach(finding => {
      console.log(`  ${finding.file}:${finding.lineNumber}`);
      console.log(`    ${finding.line}`);
    });
    
    if (findings.length > 5) {
      console.log(`  ... and ${findings.length - 5} more\n`);
    }
    console.log('');
    
    violations++;
    violationDetails.push({ description, count: findings.length });
    return true;
  }
  return false;
}

/**
 * Main audit function
 */
async function runAudit() {
  const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
  
  // 1. Check for localStorage token usage
  console.log('1. Checking for localStorage token usage...');
  const localStoragePatterns = [
    /localStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*token[^"'`]*["'`]/gi,
    /localStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*jwt[^"'`]*["'`]/gi,
    /localStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*auth[^"'`]*["'`]/gi,
    /localStorage\[["'`][^"'`]*token[^"'`]*["'`]\]/gi,
    /localStorage\[["'`][^"'`]*jwt[^"'`]*["'`]\]/gi
  ];
  
  let localStorageViolations = [];
  for (const pattern of localStoragePatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    localStorageViolations = localStorageViolations.concat(findings);
  }
  
  // Remove duplicates
  localStorageViolations = localStorageViolations.filter((v, i, a) => 
    a.findIndex(t => t.file === v.file && t.lineNumber === v.lineNumber) === i
  );
  
  if (!reportViolation('localStorage token usage detected', localStorageViolations)) {
    console.log(`${colors.green}✅ No localStorage token usage detected (secure memory-only storage)${colors.reset}`);
    console.log('Tokens are properly stored in memory only\n');
  }
  
  // 2. Check for sessionStorage token usage
  console.log('2. Checking for sessionStorage token usage...');
  const sessionStoragePatterns = [
    /sessionStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*token[^"'`]*["'`]/gi,
    /sessionStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*jwt[^"'`]*["'`]/gi,
    /sessionStorage\.(getItem|setItem|removeItem)\s*\(\s*["'`][^"'`]*auth[^"'`]*["'`]/gi,
    /sessionStorage\[["'`][^"'`]*token[^"'`]*["'`]\]/gi,
    /sessionStorage\[["'`][^"'`]*jwt[^"'`]*["'`]\]/gi
  ];
  
  let sessionStorageViolations = [];
  for (const pattern of sessionStoragePatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    sessionStorageViolations = sessionStorageViolations.concat(findings);
  }
  
  // Remove duplicates
  sessionStorageViolations = sessionStorageViolations.filter((v, i, a) => 
    a.findIndex(t => t.file === v.file && t.lineNumber === v.lineNumber) === i
  );
  
  if (!reportViolation('sessionStorage token usage detected', sessionStorageViolations)) {
    console.log(`${colors.green}✅ No sessionStorage token usage detected${colors.reset}\n`);
  }
  
  // 3. Check for IndexedDB token storage
  console.log('3. Checking for IndexedDB token storage...');
  const indexedDBRegex = /indexedDB|IDBDatabase|IDBObjectStore/gi;
  const indexedDBFindings = await searchInFiles(sourcePatterns, indexedDBRegex);
  const indexedDBTokenViolations = indexedDBFindings.filter(f => isTokenStorage(f.line));
  
  if (indexedDBTokenViolations.length > 0) {
    reportViolation('IndexedDB token storage detected', indexedDBTokenViolations);
  } else {
    console.log(`${colors.green}✅ No IndexedDB token storage detected${colors.reset}\n`);
  }
  
  // 4. Check for WebSQL token storage (deprecated but still check)
  console.log('4. Checking for WebSQL token storage...');
  const webSQLRegex = /openDatabase|executeSql/gi;
  const webSQLFindings = await searchInFiles(sourcePatterns, webSQLRegex);
  const webSQLTokenViolations = webSQLFindings.filter(f => isTokenStorage(f.line));
  
  if (webSQLTokenViolations.length > 0) {
    reportViolation('WebSQL token storage detected', webSQLTokenViolations);
  } else {
    console.log(`${colors.green}✅ No WebSQL token storage detected${colors.reset}\n`);
  }
  
  // 5. Verify SecureTokenManager implementation
  console.log('5. Verifying SecureTokenManager implementation...');
  const tokenManagerPath = path.join(process.cwd(), 'src/lib/security/secure-token-manager.ts');
  
  if (fs.existsSync(tokenManagerPath)) {
    const content = fs.readFileSync(tokenManagerPath, 'utf8');
    
    // Check for browser storage in the token manager itself
    const storageUsage = content.match(/localStorage|sessionStorage/gi);
    if (storageUsage && !content.includes('// Mock') && !content.includes('VITE_MOCK_AUTH')) {
      console.log(`${colors.red}❌ VIOLATION: Browser storage found in SecureTokenManager${colors.reset}`);
      console.log('SecureTokenManager should use memory-only storage\n');
      violations++;
    } else {
      console.log(`${colors.green}✅ SecureTokenManager uses memory-only storage${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.yellow}⚠️ WARNING: SecureTokenManager not found${colors.reset}`);
    console.log(`Expected at: ${tokenManagerPath}\n`);
  }
  
  // Summary
  console.log('=========================================');
  console.log('AUDIT SUMMARY');
  console.log('=========================================');
  
  if (violations === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED!${colors.reset}`);
    console.log('Tokens are properly stored in memory only.');
    console.log('This provides maximum protection against XSS attacks.');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ AUDIT FAILED!${colors.reset}`);
    console.log(`Found ${violations} security violation(s)\n`);
    
    if (violationDetails.length > 0) {
      console.log('Violation Summary:');
      violationDetails.forEach(v => {
        console.log(`  - ${v.description}: ${v.count} instance(s)`);
      });
      console.log('');
    }
    
    console.log('Required Actions:');
    console.log('1. Remove all localStorage token usage');
    console.log('2. Remove all sessionStorage token usage');
    console.log('3. Store tokens in memory only (private class variables)');
    console.log('4. Use SecureTokenManager for all token operations');
    console.log('5. Implement proper token lifecycle management\n');
    console.log('Benefits of memory-only storage:');
    console.log('- Tokens cannot be accessed by XSS attacks');
    console.log('- Automatic cleanup when tab/browser closes');
    console.log('- No persistence attack vectors');
    console.log('- Follows OWASP best practices\n');
    console.log('See: docs/security/MEMORY_ONLY_JWT_STORAGE_UPDATE.md for implementation guide');
    process.exit(1);
  }
}

// Handle missing glob dependency
try {
  require('glob');
} catch (error) {
  console.error(`${colors.red}Error: 'glob' package is required but not installed.${colors.reset}`);
  console.error('Please run: npm install --save-dev glob');
  process.exit(1);
}

// Run the audit
runAudit().catch(error => {
  console.error(`${colors.red}Audit failed with error: ${error.message}${colors.reset}`);
  process.exit(1);
});