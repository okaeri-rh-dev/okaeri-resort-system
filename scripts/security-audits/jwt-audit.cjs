#!/usr/bin/env node

/**
 * JWT Cookie Security Audit - Cross-Platform Node.js Version
 * 
 * This script audits the codebase to ensure JWT tokens are NEVER stored in cookies.
 * It enforces the JWT Authorization Header Only Policy.
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Security violations found
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');
const globAsync = promisify(glob);

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Track violations and warnings
let violations = 0;
let warnings = 0;
const violationDetails = [];

console.log('🔒 JWT Cookie Security Audit v2.0 (Node.js)');
console.log('===========================================');
console.log('Verifying JWT Authorization Header Only Policy\n');

/**
 * Search for patterns in files
 * @param {string[]} patterns - Glob patterns to search
 * @param {RegExp} searchRegex - Regular expression to search for
 * @param {RegExp} filterRegex - Optional filter for results
 * @returns {Array} Array of {file, line, match} objects
 */
async function searchInFiles(patterns, searchRegex, filterRegex = null) {
  const results = [];
  
  try {
    const files = await globAsync(patterns, { 
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          if (!filterRegex || filterRegex.test(line)) {
            // Skip comments
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('/*')) {
              results.push({
                file: path.relative(process.cwd(), file),
                lineNumber: index + 1,
                line: line.trim(),
                match: line.match(searchRegex)[0]
              });
            }
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
 * Report violations
 * @param {string} description - Description of the violation
 * @param {Array} findings - Array of findings
 * @returns {boolean} True if violations found
 */
function reportViolation(description, findings) {
  if (findings.length > 0) {
    console.log(`${colors.red}❌ SECURITY VIOLATION: ${description}${colors.reset}`);
    console.log('Found in:');
    
    // Show first 10 violations
    findings.slice(0, 10).forEach(finding => {
      console.log(`  ${finding.file}:${finding.lineNumber}`);
      console.log(`    ${finding.line}`);
    });
    
    if (findings.length > 10) {
      console.log(`  ... and ${findings.length - 10} more`);
    }
    console.log('');
    
    violations++;
    violationDetails.push({ description, count: findings.length });
    return true;
  }
  return false;
}

/**
 * Report warnings
 * @param {string} description - Description of the warning
 * @param {boolean} condition - Warning condition
 * @param {string} expected - Expected behavior
 */
function reportWarning(description, condition, expected) {
  if (condition) {
    console.log(`${colors.yellow}⚠️ WARNING: ${description}${colors.reset}`);
    console.log(`Expected: ${expected}\n`);
    warnings++;
  }
}

/**
 * Main audit function
 */
async function runAudit() {
  const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,js}'];
  
  // 1. Check for document.cookie usage with auth tokens
  console.log('1. Checking for cookie-based JWT storage...');
  const cookieRegex = /document\.cookie/gi;
  const authTokenRegex = /\b(token|jwt|auth|bearer|session)\b/gi;
  const cookieViolations = await searchInFiles(sourcePatterns, cookieRegex, authTokenRegex);
  
  if (!reportViolation('JWT/token storage in cookies detected', cookieViolations)) {
    console.log(`${colors.green}✅ No JWT cookie usage detected${colors.reset}\n`);
  }
  
  // 2. Check for Set-Cookie headers in API
  console.log('2. Checking for Set-Cookie headers with JWT...');
  const setCookieRegex = /Set-Cookie|set-cookie/gi;
  const setCookieViolations = await searchInFiles(['api/**/*.{ts,js}'], setCookieRegex, authTokenRegex);
  
  if (!reportViolation('API setting JWT/token cookies', setCookieViolations)) {
    console.log(`${colors.green}✅ No Set-Cookie headers for JWT/tokens${colors.reset}\n`);
  }
  
  // 3. Check for credentials: 'include' pattern
  console.log('3. Checking for credentials: \'include\' usage...');
  const credentialsRegex = /credentials\s*:\s*["']include["']/gi;
  const credentialsViolations = await searchInFiles(sourcePatterns, credentialsRegex);
  
  if (!reportViolation('credentials: \'include\' found (incompatible with JWT-only)', credentialsViolations)) {
    console.log(`${colors.green}✅ No credentials: \'include\' usage${colors.reset}\n`);
  }
  
  // 4. Check for withCredentials in axios/fetch
  console.log('4. Checking for withCredentials usage...');
  const withCredentialsRegex = /withCredentials\s*:\s*true/gi;
  const withCredentialsViolations = await searchInFiles(sourcePatterns, withCredentialsRegex);
  
  if (!reportViolation('withCredentials: true found (not needed for JWT)', withCredentialsViolations)) {
    console.log(`${colors.green}✅ No withCredentials usage${colors.reset}\n`);
  }
  
  // 5. Check for httpOnly cookie configuration
  console.log('5. Checking for httpOnly cookie configuration...');
  const httpOnlyRegex = /httpOnly\s*:\s*true/gi;
  const httpOnlyViolations = await searchInFiles(sourcePatterns, httpOnlyRegex, authTokenRegex);
  
  if (!reportViolation('httpOnly cookie configuration for JWT found', httpOnlyViolations)) {
    console.log(`${colors.green}✅ No httpOnly JWT cookie configuration${colors.reset}\n`);
  }
  
  // 6. Check for CSRF token usage (should be NONE)
  console.log('6. Checking for CSRF token usage (not needed with JWT)...');
  const csrfRegex = /\b(csrf|xsrf|CSRF|XSRF)\b/g;
  const csrfFindings = await searchInFiles(sourcePatterns, csrfRegex);
  
  if (csrfFindings.length > 0) {
    console.log(`${colors.yellow}⚠️ WARNING: CSRF token references found${colors.reset}`);
    console.log('JWT-only authentication doesn\'t require CSRF tokens.');
    console.log(`Found ${csrfFindings.length} references\n`);
    warnings++;
  } else {
    console.log(`${colors.green}✅ No CSRF token usage (correct for JWT-only)${colors.reset}\n`);
  }
  
  // Summary
  console.log('===========================================');
  console.log('AUDIT SUMMARY');
  console.log('===========================================');
  
  if (violations === 0 && warnings === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED!${colors.reset}`);
    console.log('JWT Authorization Header Only Policy is properly implemented.');
    process.exit(0);
  } else if (violations === 0) {
    console.log(`${colors.yellow}⚠️ Audit completed with ${warnings} warning(s)${colors.reset}`);
    console.log('Review warnings above for best practices.');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ AUDIT FAILED!${colors.reset}`);
    console.log(`Found ${violations} security violation(s) and ${warnings} warning(s)\n`);
    
    if (violationDetails.length > 0) {
      console.log('Violation Summary:');
      violationDetails.forEach(v => {
        console.log(`  - ${v.description}: ${v.count} instance(s)`);
      });
      console.log('');
    }
    
    console.log('Required Actions:');
    console.log('1. Remove all JWT cookie usage');
    console.log('2. Use Authorization: Bearer headers for API calls');
    console.log('3. Remove credentials: \'include\' from fetch calls');
    console.log('4. Remove CSRF token handling if present');
    console.log('5. Ensure tokens are stored in SecureTokenManager class only\n');
    console.log('See: docs/security/JWT_TESTING_PATTERNS.md for implementation guide');
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