#!/usr/bin/env node

/**
 * Cross-Platform Security Audit Runner
 * 
 * This script detects the platform and runs the appropriate version
 * of security audit scripts (bash for Unix-like systems, Node.js for Windows).
 * 
 * Usage:
 *   node scripts/security-audits/run-audit.js <audit-type>
 * 
 * Audit types:
 *   - jwt-cookies: Check for JWT cookie usage
 *   - storage: Verify memory-only token storage
 *   - headers: Check Authorization Bearer usage
 *   - no-cookies: Ensure no cookie-based auth
 *   - all: Run all audits
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Get audit type from command line
const auditType = process.argv[2];

if (!auditType) {
  console.error(`${colors.red}Error: Please specify an audit type${colors.reset}`);
  console.log('Usage: node run-audit.js <audit-type>');
  console.log('Available types: jwt-cookies, storage, headers, no-cookies, all');
  process.exit(1);
}

// Detect platform
const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

console.log(`${colors.cyan}Platform detected: ${platform}${colors.reset}`);

/**
 * Check if bash is available
 */
function hasBash() {
  try {
    execSync('bash --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if glob package is installed
 */
function hasGlobPackage() {
  try {
    require('glob');
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a bash script
 */
function runBashScript(scriptName) {
  const scriptPath = path.join(__dirname, '..', scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${colors.red}Error: Bash script not found: ${scriptPath}${colors.reset}`);
    return Promise.reject(new Error('Script not found'));
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run a Node.js script
 */
function runNodeScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`${colors.red}Error: Node.js script not found: ${scriptPath}${colors.reset}`);
    return Promise.reject(new Error('Script not found'));
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Map audit types to scripts
 */
const auditScripts = {
  'jwt-cookies': {
    bash: 'audit-jwt-cookies.sh',
    node: 'jwt-audit.cjs',
    description: 'JWT Cookie Security Audit'
  },
  'storage': {
    bash: 'audit-storage.sh',
    node: 'storage-audit.cjs',
    description: 'Storage Security Audit'
  },
  'headers': {
    bash: 'audit-headers.sh',
    node: 'header-audit.cjs',
    description: 'Authorization Header Audit'
  },
  'no-cookies': {
    bash: 'audit-no-cookies.sh',
    node: 'no-cookies-audit.cjs',
    description: 'No-Cookies Authentication Audit'
  }
};

/**
 * Run the appropriate audit
 */
async function runAudit(type) {
  if (type === 'all') {
    console.log(`${colors.cyan}Running all security audits...${colors.reset}\n`);
    
    let allPassed = true;
    for (const [key, script] of Object.entries(auditScripts)) {
      console.log(`\n${colors.cyan}═══ ${script.description} ═══${colors.reset}\n`);
      try {
        await runAudit(key);
        console.log(`${colors.green}✅ ${script.description} passed${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}❌ ${script.description} failed${colors.reset}`);
        allPassed = false;
      }
    }
    
    if (allPassed) {
      console.log(`\n${colors.green}✅ All security audits passed!${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}❌ Some security audits failed${colors.reset}`);
      process.exit(1);
    }
  }
  
  const script = auditScripts[type];
  if (!script) {
    console.error(`${colors.red}Error: Unknown audit type: ${type}${colors.reset}`);
    console.log('Available types:', Object.keys(auditScripts).join(', '), 'all');
    process.exit(1);
  }
  
  console.log(`${colors.cyan}Running ${script.description}...${colors.reset}\n`);
  
  // Determine which version to run
  let useNodeVersion = false;
  
  if (isWindows) {
    // On Windows, prefer Node.js version
    if (!hasGlobPackage()) {
      console.log(`${colors.yellow}Warning: 'glob' package not installed${colors.reset}`);
      console.log('Installing glob package...');
      try {
        execSync('npm install --save-dev glob', { stdio: 'inherit' });
      } catch (error) {
        console.error(`${colors.red}Failed to install glob package${colors.reset}`);
        process.exit(1);
      }
    }
    useNodeVersion = true;
  } else {
    // On Unix-like systems, prefer bash but fall back to Node.js
    if (hasBash()) {
      // Check if bash script exists
      const bashScriptPath = path.join(__dirname, '..', script.bash);
      if (fs.existsSync(bashScriptPath)) {
        useNodeVersion = false;
      } else {
        console.log(`${colors.yellow}Bash script not found, using Node.js version${colors.reset}`);
        useNodeVersion = true;
      }
    } else {
      console.log(`${colors.yellow}Bash not available, using Node.js version${colors.reset}`);
      useNodeVersion = true;
    }
  }
  
  try {
    if (useNodeVersion) {
      if (!hasGlobPackage()) {
        console.log(`${colors.yellow}Installing required 'glob' package...${colors.reset}`);
        execSync('npm install --save-dev glob', { stdio: 'inherit' });
      }
      await runNodeScript(script.node);
    } else {
      await runBashScript(script.bash);
    }
  } catch (error) {
    console.error(`${colors.red}Audit failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the audit
runAudit(auditType).catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});