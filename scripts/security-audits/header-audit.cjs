#!/usr/bin/env node

/**
 * Authorization Header Audit - Cross-Platform Node.js Version
 * 
 * This script verifies that the codebase properly uses Authorization Bearer headers
 * for JWT authentication and doesn't rely on cookie-based authentication.
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Critical issues found
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
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Track findings
let authHeaderCount = 0;
let apiCallsWithoutAuth = [];
let improperAuthPatterns = [];
const positiveFindings = [];
const warnings = [];

console.log('🔒 Authorization Header Audit v2.0 (Node.js)');
console.log('============================================');
console.log('Verifying proper Authorization Bearer header usage\n');

/**
 * Search for patterns in files
 * @param {string[]} patterns - Glob patterns to search
 * @param {RegExp} searchRegex - Regular expression to search for
 * @param {boolean} excludeTests - Whether to exclude test files
 * @returns {Array} Array of {file, line, match} objects
 */
async function searchInFiles(patterns, searchRegex, excludeTests = true) {
  const results = [];
  
  const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];
  if (excludeTests) {
    ignorePatterns.push('**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx');
  }
  
  try {
    const files = await globAsync(patterns, { ignore: ignorePatterns });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          const trimmedLine = line.trim();
          // Skip comments
          if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('/*')) {
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
 * Analyze fetch/axios calls for proper auth headers
 * @param {string} filePath - Path to file to analyze
 * @returns {Object} Analysis results
 */
function analyzeApiCalls(filePath, content) {
  const results = {
    properAuth: [],
    missingAuth: [],
    improperAuth: []
  };
  
  const lines = content.split('\n');
  
  // Look for fetch calls
  const fetchRegex = /fetch\s*\(\s*["'`]/gi;
  const axiosRegex = /axios\.(get|post|put|patch|delete)\s*\(/gi;
  
  lines.forEach((line, index) => {
    if (fetchRegex.test(line) || axiosRegex.test(line)) {
      // Check if it's an API call (not external URL)
      if (line.includes('/api/') || line.includes('${') && line.includes('api')) {
        // Look for Authorization header in the next few lines
        let hasAuth = false;
        let authType = null;
        
        for (let i = index; i < Math.min(index + 20, lines.length); i++) {
          const checkLine = lines[i];
          
          if (checkLine.includes('Authorization') && checkLine.includes('Bearer')) {
            hasAuth = true;
            authType = 'Bearer';
            break;
          } else if (checkLine.includes('Authorization')) {
            hasAuth = true;
            authType = 'Other';
            break;
          } else if (checkLine.includes('getAuthHeaders') || checkLine.includes('secureTokenManager')) {
            hasAuth = true;
            authType = 'SecureTokenManager';
            break;
          }
          
          // Stop if we hit the end of the call
          if (checkLine.includes('})') || checkLine.includes('}).')) {
            break;
          }
        }
        
        const finding = {
          file: path.relative(process.cwd(), filePath),
          lineNumber: index + 1,
          line: line.trim()
        };
        
        if (hasAuth && authType === 'Bearer' || authType === 'SecureTokenManager') {
          results.properAuth.push(finding);
        } else if (hasAuth && authType === 'Other') {
          results.improperAuth.push(finding);
        } else {
          // Check if it's a public endpoint
          const isPublic = line.includes('/auth/login') || 
                          line.includes('/auth/register') || 
                          line.includes('/auth/refresh') ||
                          line.includes('/public/');
          
          if (!isPublic) {
            results.missingAuth.push(finding);
          }
        }
      }
    }
  });
  
  return results;
}

/**
 * Main audit function
 */
async function runAudit() {
  const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,js}'];
  
  // 1. Check for Authorization Bearer header usage
  console.log('1. Checking for Authorization Bearer header pattern...');
  const authHeaderPatterns = [
    /Authorization.*Bearer/gi,
    /Authorization.*\`Bearer/gi,
    /['"]Authorization['"]\s*:\s*\`Bearer/gi,
    /headers\s*\[['"]Authorization['"]\]\s*=\s*['"`]Bearer/gi
  ];
  
  let authHeaderFindings = [];
  for (const pattern of authHeaderPatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    authHeaderFindings = authHeaderFindings.concat(findings);
  }
  
  // Remove duplicates
  authHeaderFindings = authHeaderFindings.filter((v, i, a) => 
    a.findIndex(t => t.file === v.file && t.lineNumber === v.lineNumber) === i
  );
  
  authHeaderCount = authHeaderFindings.length;
  
  if (authHeaderCount > 0) {
    console.log(`${colors.green}✅ Authorization Bearer header pattern detected${colors.reset}`);
    console.log(`Found ${authHeaderCount} instances in ${new Set(authHeaderFindings.map(f => f.file)).size} files\n`);
    
    // Show sample of proper implementations
    console.log('Sample implementations:');
    authHeaderFindings.slice(0, 3).forEach(finding => {
      console.log(`  ${colors.cyan}${finding.file}:${finding.lineNumber}${colors.reset}`);
      console.log(`    ${finding.line}`);
    });
    console.log('');
  } else {
    console.log(`${colors.yellow}⚠️ WARNING: No Authorization Bearer header usage found${colors.reset}`);
    console.log('Expected: headers[\'Authorization\'] = `Bearer ${token}`\n');
    warnings.push('No Authorization Bearer headers found');
  }
  
  // 2. Check for getAuthHeaders utility usage
  console.log('2. Checking for SecureTokenManager.getAuthHeaders() usage...');
  const authUtilPatterns = [
    /getAuthHeaders\s*\(\)/gi,
    /secureTokenManager\.getAuthHeaders/gi,
    /tokenManager\.getAuthHeaders/gi
  ];
  
  let authUtilFindings = [];
  for (const pattern of authUtilPatterns) {
    const findings = await searchInFiles(sourcePatterns, pattern);
    authUtilFindings = authUtilFindings.concat(findings);
  }
  
  if (authUtilFindings.length > 0) {
    console.log(`${colors.green}✅ SecureTokenManager.getAuthHeaders() utility detected${colors.reset}`);
    console.log(`Found ${authUtilFindings.length} usage(s)\n`);
  } else {
    console.log(`${colors.cyan}ℹ️ No getAuthHeaders() utility usage found${colors.reset}`);
    console.log('Consider using a centralized auth header utility\n');
  }
  
  // 3. Analyze API calls for proper authentication
  console.log('3. Analyzing API calls for proper authentication...');
  
  try {
    const files = await globAsync(sourcePatterns, { 
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const analysis = analyzeApiCalls(file, content);
      
      if (analysis.properAuth.length > 0) {
        positiveFindings.push(...analysis.properAuth);
      }
      if (analysis.missingAuth.length > 0) {
        apiCallsWithoutAuth.push(...analysis.missingAuth);
      }
      if (analysis.improperAuth.length > 0) {
        improperAuthPatterns.push(...analysis.improperAuth);
      }
    }
    
    if (positiveFindings.length > 0) {
      console.log(`${colors.green}✅ Found ${positiveFindings.length} API calls with proper Bearer authentication${colors.reset}\n`);
    }
    
    if (apiCallsWithoutAuth.length > 0) {
      console.log(`${colors.yellow}⚠️ WARNING: ${apiCallsWithoutAuth.length} API calls may be missing authentication${colors.reset}`);
      console.log('Review these calls:');
      apiCallsWithoutAuth.slice(0, 5).forEach(call => {
        console.log(`  ${call.file}:${call.lineNumber}`);
        console.log(`    ${call.line}`);
      });
      if (apiCallsWithoutAuth.length > 5) {
        console.log(`  ... and ${apiCallsWithoutAuth.length - 5} more`);
      }
      console.log('');
    }
    
    if (improperAuthPatterns.length > 0) {
      console.log(`${colors.red}❌ Found ${improperAuthPatterns.length} API calls with non-Bearer authentication${colors.reset}`);
      console.log('These should use Bearer tokens:');
      improperAuthPatterns.slice(0, 3).forEach(call => {
        console.log(`  ${call.file}:${call.lineNumber}`);
        console.log(`    ${call.line}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error(`Error analyzing API calls: ${error.message}`);
  }
  
  // 4. Check for common auth header mistakes
  console.log('4. Checking for common authentication mistakes...');
  
  const mistakes = [
    { pattern: /headers.*authorization.*["']bearer\s+/gi, issue: 'Lowercase "bearer" - should be "Bearer"' },
    { pattern: /Authorization.*Basic/gi, issue: 'Basic authentication found - should use Bearer tokens' },
    { pattern: /X-Auth-Token|x-auth-token/gi, issue: 'Custom auth header - should use standard Authorization' },
    { pattern: /api[_-]?key/gi, issue: 'API key pattern - consider using JWT Bearer tokens' }
  ];
  
  for (const mistake of mistakes) {
    const findings = await searchInFiles(sourcePatterns, mistake.pattern);
    if (findings.length > 0) {
      console.log(`${colors.yellow}⚠️ Issue: ${mistake.issue}${colors.reset}`);
      console.log(`  Found ${findings.length} instance(s)`);
      warnings.push(mistake.issue);
    }
  }
  
  if (warnings.length === 0) {
    console.log(`${colors.green}✅ No common authentication mistakes found${colors.reset}\n`);
  } else {
    console.log('');
  }
  
  // Summary
  console.log('============================================');
  console.log('AUDIT SUMMARY');
  console.log('============================================');
  
  const hasIssues = authHeaderCount === 0 || improperAuthPatterns.length > 0;
  
  if (!hasIssues && warnings.length === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED!${colors.reset}`);
    console.log('Authorization Bearer headers are properly implemented.');
    console.log(`\nStatistics:`);
    console.log(`  - Bearer header instances: ${authHeaderCount}`);
    console.log(`  - Properly authenticated API calls: ${positiveFindings.length}`);
    console.log(`  - Potential missing auth: ${apiCallsWithoutAuth.length}`);
    process.exit(0);
  } else if (improperAuthPatterns.length > 0 || authHeaderCount === 0) {
    console.log(`${colors.red}❌ CRITICAL ISSUES FOUND!${colors.reset}`);
    console.log(`\nIssues:`);
    if (authHeaderCount === 0) {
      console.log('  - No Authorization Bearer headers found');
    }
    if (improperAuthPatterns.length > 0) {
      console.log(`  - ${improperAuthPatterns.length} API calls with improper authentication`);
    }
    console.log('\nRequired Actions:');
    console.log('1. Implement Authorization: Bearer headers for all API calls');
    console.log('2. Use SecureTokenManager.getAuthHeaders() for consistency');
    console.log('3. Remove any non-Bearer authentication patterns');
    console.log('4. Ensure all protected endpoints check for Bearer tokens\n');
    console.log('Example implementation:');
    console.log('  const headers = secureTokenManager.getAuthHeaders();');
    console.log('  // or');
    console.log('  headers["Authorization"] = `Bearer ${token}`;\n');
    console.log('See: docs/security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md');
    process.exit(1);
  } else {
    console.log(`${colors.yellow}⚠️ Audit completed with warnings${colors.reset}`);
    console.log(`\nWarnings found:`);
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('\nReview the warnings above and consider improvements.');
    process.exit(0);
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