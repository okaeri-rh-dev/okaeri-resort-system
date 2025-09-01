#!/usr/bin/env node

/**
 * Enhanced Storage Security Audit - Environment-Aware Version
 * 
 * This script verifies JWT token storage compliance across different environments:
 * - Production: Memory-only, NO Web Storage APIs allowed
 * - Development: Memory-only by default, sessionStorage allowed ONLY for mock tokens with proper gating
 * - Test/CI: Memory-only, NO Web Storage APIs allowed
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
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const isDevelopment = NODE_ENV === 'development';
const isMockAuthEnabled = process.env.VITE_MOCK_AUTH === 'true';

// Track violations
let violations = 0;
let warnings = 0;
const violationDetails = [];
const warningDetails = [];

console.log('🔒 Enhanced Storage Security Audit v3.0');
console.log('=========================================');
console.log(`Environment: ${colors.cyan}${NODE_ENV.toUpperCase()}${colors.reset}`);
console.log(`Mock Auth: ${isMockAuthEnabled ? colors.yellow + 'ENABLED' : colors.green + 'DISABLED'}${colors.reset}`);
console.log('=========================================\n');

/**
 * Check if code is properly gated with isDevelopmentMockAuth()
 * @param {string} content - File content
 * @param {number} lineIndex - Line index where storage is used
 * @returns {boolean} True if properly gated
 */
function isProperlyGated(content, lineIndex) {
  const lines = content.split('\n');
  
  // Look for gating within 15 lines before the usage
  const contextStart = Math.max(0, lineIndex - 15);
  const contextEnd = lineIndex + 1;
  const contextLines = lines.slice(contextStart, contextEnd).join('\n');
  
  // Check for proper gating patterns
  const gatingPatterns = [
    /isDevelopmentMockAuth\s*\(\)/,
    /if\s*\(\s*this\.isDevelopmentMockAuth\(\)\s*\)/,
    /import\.meta\.env\.DEV\s*&&.*VITE_MOCK_AUTH/,
    /VITE_MOCK_AUTH\s*===\s*["']true["']/
  ];
  
  return gatingPatterns.some(pattern => pattern.test(contextLines));
}

/**
 * Check if a key is a mock token key
 * @param {string} key - Storage key
 * @returns {boolean} True if mock token key
 */
function isMockTokenKey(key) {
  return key.startsWith('mock_') && (
    key.includes('token') || 
    key.includes('jwt') || 
    key.includes('auth')
  );
}

/**
 * Search for patterns in files
 * @param {string[]} patterns - Glob patterns to search
 * @param {RegExp} searchRegex - Regular expression to search for
 * @returns {Array} Array of findings
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
        '**/*.spec.tsx',
        '**/test-utils.*',
        '**/mocks/**'
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
              match: line.match(searchRegex)[0],
              content: content,
              lineIndex: index
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
 * Analyze storage usage for compliance
 * @param {Array} findings - Array of findings
 * @param {string} storageType - Type of storage (localStorage/sessionStorage)
 * @returns {Object} Categorized violations and warnings
 */
function analyzeStorageUsage(findings, storageType) {
  const analysis = {
    realTokenViolations: [],
    ungatedMockTokens: [],
    properlyGatedMockTokens: [],
    nonTokenUsage: []
  };
  
  findings.forEach(finding => {
    // Extract the storage key
    const keyMatch = finding.line.match(new RegExp(`${storageType}\\.[gs]etItem\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`));
    
    if (keyMatch) {
      const key = keyMatch[1];
      const isTokenRelated = key.includes('token') || key.includes('jwt') || key.includes('auth');
      
      if (isTokenRelated) {
        if (isMockTokenKey(key)) {
          // Mock token - check if properly gated
          if (isProperlyGated(finding.content, finding.lineIndex)) {
            analysis.properlyGatedMockTokens.push(finding);
          } else {
            analysis.ungatedMockTokens.push(finding);
          }
        } else {
          // Real token - always a violation
          analysis.realTokenViolations.push(finding);
        }
      } else {
        analysis.nonTokenUsage.push(finding);
      }
    }
  });
  
  return analysis;
}

/**
 * Report violations based on environment
 * @param {string} storageType - Type of storage
 * @param {Object} analysis - Analysis results
 */
function reportStorageAnalysis(storageType, analysis) {
  let hasViolations = false;
  
  // Real tokens in storage - ALWAYS a violation
  if (analysis.realTokenViolations.length > 0) {
    console.log(`${colors.red}❌ CRITICAL VIOLATION: Real JWT tokens in ${storageType}${colors.reset}`);
    console.log('Real tokens must NEVER be stored in browser storage APIs');
    console.log('Found violations:');
    
    analysis.realTokenViolations.slice(0, 3).forEach(v => {
      console.log(`  ${v.file}:${v.lineNumber}`);
      console.log(`    ${v.line}`);
    });
    
    if (analysis.realTokenViolations.length > 3) {
      console.log(`  ... and ${analysis.realTokenViolations.length - 3} more`);
    }
    console.log('');
    
    violations++;
    violationDetails.push({
      type: `Real tokens in ${storageType}`,
      count: analysis.realTokenViolations.length
    });
    hasViolations = true;
  }
  
  // Ungated mock tokens
  if (analysis.ungatedMockTokens.length > 0) {
    if (isProduction) {
      // Production: Any sessionStorage is a violation
      console.log(`${colors.red}❌ PRODUCTION VIOLATION: Mock tokens in ${storageType}${colors.reset}`);
      console.log('NO browser storage is allowed in production builds');
      violations++;
      violationDetails.push({
        type: `Mock tokens in ${storageType} (production)`,
        count: analysis.ungatedMockTokens.length
      });
    } else {
      // Development: Must be properly gated
      console.log(`${colors.yellow}⚠️ WARNING: Ungated mock token storage in ${storageType}${colors.reset}`);
      console.log('Mock token storage must be gated with isDevelopmentMockAuth()');
      
      analysis.ungatedMockTokens.slice(0, 3).forEach(v => {
        console.log(`  ${v.file}:${v.lineNumber}`);
        console.log(`    ${v.line}`);
        console.log(`    Missing: if (this.isDevelopmentMockAuth()) { ... }`);
      });
      
      warnings++;
      warningDetails.push({
        type: `Ungated mock tokens in ${storageType}`,
        count: analysis.ungatedMockTokens.length
      });
    }
    hasViolations = true;
  }
  
  // Properly gated mock tokens
  if (analysis.properlyGatedMockTokens.length > 0) {
    if (isProduction) {
      console.log(`${colors.yellow}⚠️ WARNING: Mock token code in production build${colors.reset}`);
      console.log('Consider removing development-only code from production builds');
      warnings++;
    } else {
      console.log(`${colors.green}✅ Properly gated mock tokens in ${storageType}: ${analysis.properlyGatedMockTokens.length} usage(s)${colors.reset}`);
    }
  }
  
  // Non-token usage (informational)
  if (analysis.nonTokenUsage.length > 0 && !hasViolations) {
    console.log(`ℹ️  Non-token ${storageType} usage: ${analysis.nonTokenUsage.length} instance(s)`);
  }
  
  return hasViolations;
}

/**
 * Main audit function
 */
async function runAudit() {
  const sourcePatterns = ['src/**/*.{ts,tsx,js,jsx}'];
  
  // 1. Check localStorage (ALWAYS prohibited for tokens)
  console.log('1. Checking localStorage usage...');
  console.log('   Policy: NO token storage allowed in any environment\n');
  
  const localStorageRegex = /localStorage\.(getItem|setItem|removeItem)/gi;
  const localStorageFindings = await searchInFiles(sourcePatterns, localStorageRegex);
  const localStorageAnalysis = analyzeStorageUsage(localStorageFindings, 'localStorage');
  
  if (!reportStorageAnalysis('localStorage', localStorageAnalysis)) {
    console.log(`${colors.green}✅ No localStorage token usage detected${colors.reset}\n`);
  }
  
  // 2. Check sessionStorage (conditional based on environment)
  console.log('\n2. Checking sessionStorage usage...');
  if (isProduction) {
    console.log('   Policy: NO storage allowed in production\n');
  } else {
    console.log('   Policy: Mock tokens allowed with isDevelopmentMockAuth() gating\n');
  }
  
  const sessionStorageRegex = /sessionStorage\.(getItem|setItem|removeItem)/gi;
  const sessionStorageFindings = await searchInFiles(sourcePatterns, sessionStorageRegex);
  const sessionStorageAnalysis = analyzeStorageUsage(sessionStorageFindings, 'sessionStorage');
  
  if (!reportStorageAnalysis('sessionStorage', sessionStorageAnalysis)) {
    console.log(`${colors.green}✅ No sessionStorage violations detected${colors.reset}\n`);
  }
  
  // 3. Verify SecureTokenManager implementation
  console.log('\n3. Verifying SecureTokenManager implementation...');
  const tokenManagerPath = path.join(process.cwd(), 'src/lib/security/secure-token-manager.ts');
  
  if (fs.existsSync(tokenManagerPath)) {
    const content = fs.readFileSync(tokenManagerPath, 'utf8');
    
    // Check for proper memory-only implementation
    const hasPrivateTokenStorage = /private\s+accessToken\s*:\s*string\s*\|\s*null/i.test(content);
    const hasIsDevelopmentMockAuth = /isDevelopmentMockAuth\s*\(\)/i.test(content);
    
    if (hasPrivateTokenStorage) {
      console.log(`${colors.green}✅ SecureTokenManager uses private memory storage${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ WARNING: Could not verify private token storage${colors.reset}`);
      warnings++;
    }
    
    if (hasIsDevelopmentMockAuth) {
      console.log(`${colors.green}✅ SecureTokenManager has isDevelopmentMockAuth() gating${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ WARNING: Missing isDevelopmentMockAuth() method${colors.reset}`);
      warnings++;
    }
    
    // Check for ungated storage usage
    const storageLines = content.split('\n');
    storageLines.forEach((line, index) => {
      if (/sessionStorage\.(setItem|getItem)/.test(line) && !line.includes('mock_')) {
        if (!isProperlyGated(content, index)) {
          console.log(`${colors.red}❌ VIOLATION: Ungated sessionStorage at line ${index + 1}${colors.reset}`);
          violations++;
        }
      }
    });
  } else {
    console.log(`${colors.red}❌ ERROR: SecureTokenManager not found${colors.reset}`);
    console.log(`Expected at: ${tokenManagerPath}`);
    violations++;
  }
  
  // 4. Check for alternative storage mechanisms
  console.log('\n4. Checking for alternative storage mechanisms...');
  
  // IndexedDB
  const indexedDBRegex = /indexedDB|IDBDatabase|IDBObjectStore/gi;
  const indexedDBFindings = await searchInFiles(sourcePatterns, indexedDBRegex);
  const tokenRelatedIndexedDB = indexedDBFindings.filter(f => 
    f.line.toLowerCase().includes('token') || 
    f.line.toLowerCase().includes('jwt') || 
    f.line.toLowerCase().includes('auth')
  );
  
  if (tokenRelatedIndexedDB.length > 0) {
    console.log(`${colors.red}❌ VIOLATION: IndexedDB token storage detected${colors.reset}`);
    violations++;
  } else {
    console.log(`${colors.green}✅ No IndexedDB token storage${colors.reset}`);
  }
  
  // Summary
  console.log('\n=========================================');
  console.log('AUDIT SUMMARY');
  console.log('=========================================');
  console.log(`Environment: ${NODE_ENV.toUpperCase()}`);
  console.log(`Violations: ${violations}`);
  console.log(`Warnings: ${warnings}\n`);
  
  if (violations === 0 && warnings === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED!${colors.reset}`);
    console.log('Token storage is compliant with security policies:');
    console.log('  ✓ Memory-only storage enforced');
    console.log('  ✓ No localStorage usage for tokens');
    if (isDevelopment) {
      console.log('  ✓ Mock tokens properly gated in development');
    }
    console.log('  ✓ Production-ready security configuration');
    process.exit(0);
  } else if (violations === 0) {
    console.log(`${colors.yellow}⚠️ Audit completed with ${warnings} warning(s)${colors.reset}`);
    
    if (warningDetails.length > 0) {
      console.log('\nWarning Summary:');
      warningDetails.forEach(w => {
        console.log(`  - ${w.type}: ${w.count} instance(s)`);
      });
    }
    
    console.log('\nRecommended Actions:');
    console.log('  - Review and fix warnings for best practices');
    console.log('  - Ensure all mock token usage is properly gated');
    console.log('  - Consider removing dev-only code from production builds');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ AUDIT FAILED!${colors.reset}`);
    console.log(`Found ${violations} violation(s) and ${warnings} warning(s)\n`);
    
    if (violationDetails.length > 0) {
      console.log('Violation Summary:');
      violationDetails.forEach(v => {
        console.log(`  ${colors.red}- ${v.type}: ${v.count} instance(s)${colors.reset}`);
      });
    }
    
    if (warningDetails.length > 0) {
      console.log('\nWarning Summary:');
      warningDetails.forEach(w => {
        console.log(`  ${colors.yellow}- ${w.type}: ${w.count} instance(s)${colors.reset}`);
      });
    }
    
    console.log('\nRequired Actions:');
    console.log('1. Remove ALL localStorage usage for tokens');
    console.log('2. Remove ALL real token storage from sessionStorage');
    console.log('3. Gate mock token storage with isDevelopmentMockAuth()');
    console.log('4. Use SecureTokenManager for all token operations');
    console.log('5. Ensure production builds have NO Web Storage usage');
    
    console.log('\nExample of proper gating:');
    console.log(`  ${colors.cyan}if (this.isDevelopmentMockAuth()) {`);
    console.log(`    sessionStorage.setItem('mock_access_token', mockToken);`);
    console.log(`  }${colors.reset}`);
    
    console.log('\nSee documentation:');
    console.log('  - docs/security/MEMORY_ONLY_JWT_STORAGE_UPDATE.md');
    console.log('  - docs/security/JWT_STORAGE_IMPLEMENTATION_GUIDE.md');
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