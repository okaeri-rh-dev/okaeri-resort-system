#!/usr/bin/env node

/**
 * No-Cookies Authentication Audit - Cross-Platform Node.js Version
 * 
 * This script ensures that the codebase doesn't use cookie-based authentication patterns.
 * It verifies the JWT Authorization Header Only Policy is strictly enforced.
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Cookie authentication patterns found
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

// Track violations
let violations = 0;
const violationDetails = [];

console.log('🔒 No-Cookies Authentication Audit v2.0 (Node.js)');
console.log('=================================================');
console.log('Ensuring no cookie-based authentication patterns\n');

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
      ignore: [
        '**/node_modules/**', 
        '**/dist/**', 
        '**/build/**', 
        '**/.git/**',
        '**/coverage/**',
        '**/*.md'
      ]
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          if (!filterRegex || filterRegex.test(line)) {
            const trimmedLine = line.trim();
            // Skip comments and documentation
            if (!trimmedLine.startsWith('//') && 
                !trimmedLine.startsWith('*') && 
                !trimmedLine.startsWith('/*')) {
              results.push({
                file: path.relative(process.cwd(), file),
                lineNumber: index + 1,
                line: trimmedLine,
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
 * @param {string} recommendation - Recommendation for fixing
 * @returns {boolean} True if violations found
 */
function reportViolation(description, findings, recommendation) {
  if (findings.length > 0) {
    console.log(`${colors.red}❌ VIOLATION: ${description}${colors.reset}`);
    console.log('Found in:');
    
    // Show first 5 violations
    findings.slice(0, 5).forEach(finding => {
      console.log(`  ${finding.file}:${finding.lineNumber}`);
      console.log(`    ${finding.line}`);
    });
    
    if (findings.length > 5) {
      console.log(`  ... and ${findings.length - 5} more`);
    }
    
    console.log(`Recommendation: ${recommendation}\n`);
    
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
  const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,js}'];
  const configPatterns = ['*.json', '*.config.{js,ts}', '.env*'];
  
  // 1. Check for Set-Cookie headers
  console.log('1. Checking for Set-Cookie headers...');
  const setCookiePatterns = [
    /Set-Cookie/gi,
    /set-cookie/g,
    /setCookie/g,
    /res\.cookie\s*\(/gi,
    /response\.cookie\s*\(/gi
  ];
  
  let setCookieFindings = [];
  for (const pattern of setCookiePatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    setCookieFindings = setCookieFindings.concat(findings);
  }
  
  // Filter out non-auth related cookies (like preferences)
  const authTokenRegex = /\b(token|jwt|auth|bearer|session|refresh)\b/gi;
  const authCookieFindings = setCookieFindings.filter(f => authTokenRegex.test(f.line));
  
  if (!reportViolation(
    'Set-Cookie headers with authentication tokens',
    authCookieFindings,
    'Use Authorization: Bearer headers instead of cookies'
  )) {
    console.log(`${colors.green}✅ No Set-Cookie headers for authentication${colors.reset}\n`);
  }
  
  // 2. Check for withCredentials configuration
  console.log('2. Checking for withCredentials configuration...');
  const withCredentialsPatterns = [
    /withCredentials\s*:\s*true/gi,
    /credentials\s*:\s*["']include["']/gi,
    /xhrFields\s*:\s*\{[^}]*withCredentials\s*:\s*true/gi
  ];
  
  let withCredentialsFindings = [];
  for (const pattern of withCredentialsPatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    withCredentialsFindings = withCredentialsFindings.concat(findings);
  }
  
  if (!reportViolation(
    'withCredentials/credentials: include configuration',
    withCredentialsFindings,
    'Remove withCredentials; use Authorization headers'
  )) {
    console.log(`${colors.green}✅ No withCredentials configuration${colors.reset}\n`);
  }
  
  // 3. Check for cookie parsing/reading
  console.log('3. Checking for cookie parsing/reading...');
  const cookieParsingPatterns = [
    /document\.cookie/gi,
    /req\.cookies/gi,
    /request\.cookies/gi,
    /getCookie\s*\(/gi,
    /parseCookies\s*\(/gi,
    /cookie\.parse\s*\(/gi,
    /cookieParser/gi
  ];
  
  let cookieParsingFindings = [];
  for (const pattern of cookieParsingPatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    cookieParsingFindings = cookieParsingFindings.concat(findings);
  }
  
  // Filter for auth-related cookie parsing
  const authCookieParsingFindings = cookieParsingFindings.filter(f => authTokenRegex.test(f.line));
  
  if (!reportViolation(
    'Cookie parsing for authentication tokens',
    authCookieParsingFindings,
    'Read tokens from SecureTokenManager instead'
  )) {
    console.log(`${colors.green}✅ No cookie parsing for authentication${colors.reset}\n`);
  }
  
  // 4. Check for httpOnly cookie configuration
  console.log('4. Checking for httpOnly cookie configuration...');
  const httpOnlyPatterns = [
    /httpOnly\s*:\s*true/gi,
    /secure\s*:\s*true.*cookie/gi,
    /sameSite\s*:\s*["'](strict|lax|none)["']/gi
  ];
  
  let httpOnlyFindings = [];
  for (const pattern of httpOnlyPatterns) {
    const findings = await searchInFiles([...sourcePatterns, ...configPatterns], pattern);
    httpOnlyFindings = httpOnlyFindings.concat(findings);
  }
  
  // Filter for auth-related configurations
  const authHttpOnlyFindings = httpOnlyFindings.filter(f => authTokenRegex.test(f.line));
  
  if (!reportViolation(
    'httpOnly/secure cookie configuration for auth',
    authHttpOnlyFindings,
    'Remove cookie configurations; use memory-only storage'
  )) {
    console.log(`${colors.green}✅ No httpOnly auth cookie configuration${colors.reset}\n`);
  }
  
  // 5. Check for cookie middleware
  console.log('5. Checking for cookie middleware...');
  const cookieMiddlewarePatterns = [
    /cookie-parser/gi,
    /express-session/gi,
    /connect-session/gi,
    /app\.use\s*\([^)]*cookie/gi,
    /middleware.*cookie/gi
  ];
  
  let cookieMiddlewareFindings = [];
  for (const pattern of cookieMiddlewarePatterns) {
    const findings = await searchInFiles([...sourcePatterns, 'package.json'], pattern);
    cookieMiddlewareFindings = cookieMiddlewareFindings.concat(findings);
  }
  
  if (cookieMiddlewareFindings.length > 0) {
    console.log(`${colors.yellow}⚠️ WARNING: Cookie middleware detected${colors.reset}`);
    console.log('Ensure these are not used for authentication:');
    cookieMiddlewareFindings.slice(0, 3).forEach(finding => {
      console.log(`  ${finding.file}:${finding.lineNumber}`);
    });
    console.log('');
  } else {
    console.log(`${colors.green}✅ No cookie middleware detected${colors.reset}\n`);
  }
  
  // 6. Check for CORS credentials configuration
  console.log('6. Checking for CORS credentials configuration...');
  const corsCredentialsPatterns = [
    /Access-Control-Allow-Credentials.*true/gi,
    /cors\s*\([^)]*credentials\s*:\s*true/gi,
    /allowCredentials\s*:\s*true/gi
  ];
  
  let corsCredentialsFindings = [];
  for (const pattern of corsCredentialsPatterns) {
    const findings = await searchInFiles([...sourcePatterns, ...configPatterns], pattern);
    corsCredentialsFindings = corsCredentialsFindings.concat(findings);
  }
  
  if (!reportViolation(
    'CORS allows credentials',
    corsCredentialsFindings,
    'Remove credentials from CORS; not needed with Bearer tokens'
  )) {
    console.log(`${colors.green}✅ CORS doesn't allow credentials${colors.reset}\n`);
  }
  
  // 7. Check for session-based authentication
  console.log('7. Checking for session-based authentication...');
  const sessionPatterns = [
    /req\.session\./gi,
    /request\.session\./gi,
    /session\.save/gi,
    /session\.destroy/gi,
    /passport\.session/gi,
    /express-session/gi
  ];
  
  let sessionFindings = [];
  for (const pattern of sessionPatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    sessionFindings = sessionFindings.concat(findings);
  }
  
  if (!reportViolation(
    'Session-based authentication patterns',
    sessionFindings,
    'Use stateless JWT authentication instead'
  )) {
    console.log(`${colors.green}✅ No session-based authentication${colors.reset}\n`);
  }
  
  // Summary
  console.log('=================================================');
  console.log('AUDIT SUMMARY');
  console.log('=================================================');
  
  if (violations === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED!${colors.reset}`);
    console.log('No cookie-based authentication patterns detected.');
    console.log('JWT Authorization Header Only Policy is enforced.\n');
    console.log('Benefits:');
    console.log('- CSRF immunity (no automatic credential submission)');
    console.log('- Simpler architecture (no cookie management)');
    console.log('- Better for APIs (consistent across all clients)');
    console.log('- Explicit security (must attach token to each request)');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ AUDIT FAILED!${colors.reset}`);
    console.log(`Found ${violations} cookie authentication pattern(s)\n`);
    
    if (violationDetails.length > 0) {
      console.log('Violation Summary:');
      violationDetails.forEach(v => {
        console.log(`  - ${v.description}: ${v.count} instance(s)`);
      });
      console.log('');
    }
    
    console.log('Required Actions:');
    console.log('1. Remove all cookie-based authentication');
    console.log('2. Remove withCredentials and credentials: include');
    console.log('3. Remove cookie parsing and middleware');
    console.log('4. Use Authorization: Bearer headers exclusively');
    console.log('5. Store tokens in memory via SecureTokenManager\n');
    console.log('Migration Guide:');
    console.log('- Replace: document.cookie = `token=${jwt}`');
    console.log('  With: secureTokenManager.setToken(jwt)');
    console.log('- Replace: credentials: "include"');
    console.log('  With: headers: { Authorization: `Bearer ${token}` }');
    console.log('- Replace: req.cookies.token');
    console.log('  With: req.headers.authorization?.replace("Bearer ", "")\n');
    console.log('See: docs/security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md');
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