#!/usr/bin/env node

/**
 * Cross-Platform Phase Scaffolding Script
 *
 * This script creates the directory structure for Okaeri Resort System phases 2-5.
 * Works on Windows, Mac, and Linux without requiring bash or shell-specific features.
 *
 * Usage:
 *   node scripts/scaffold-phase.js <phase-number>
 *   node scripts/scaffold-phase.js all
 *
 * Examples:
 *   node scripts/scaffold-phase.js 2     # Create Phase 2 directories
 *   node scripts/scaffold-phase.js all   # Create all phase directories
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

// Phase directory configurations
const phaseConfigs = {
  2: {
    name: 'Dashboard & State Management',
    basePath: 'src/features/dashboard',
    directories: ['components', 'hooks', 'stores', 'types', '__tests__'],
    gitkeepPaths: ['__tests__/.gitkeep'],
    placeholderFiles: [
      { path: 'types/index.ts', content: '// Phase 2 Dashboard Types\nexport {};' }
    ]
  },
  3: {
    name: 'Booking System',
    basePath: 'src/features/booking',
    directories: ['components', 'hooks', 'stores', 'types', '__tests__'],
    gitkeepPaths: ['__tests__/.gitkeep'],
    placeholderFiles: [
      { path: 'types/index.ts', content: '// Phase 3 Booking Types\nexport {};' }
    ]
  },
  4: {
    name: 'Financial Management',
    basePath: 'src/features/financial',
    directories: ['components', 'hooks', 'stores', 'types', '__tests__'],
    gitkeepPaths: ['__tests__/.gitkeep'],
    placeholderFiles: [
      { path: 'types/index.ts', content: '// Phase 4 Financial Types\nexport {};' }
    ]
  },
  5: {
    name: 'Production Deployment',
    basePath: 'src/features/deployment',
    directories: ['components', 'utils', '__tests__'],
    gitkeepPaths: ['__tests__/.gitkeep'],
    placeholderFiles: [
      { path: 'utils/index.ts', content: '// Phase 5 Deployment Utilities\nexport {};' }
    ],
    additionalPaths: [
      { basePath: 'tests/e2e/deployment', gitkeep: true }
    ]
  }
};

/**
 * Creates a directory recursively (like mkdir -p)
 * @param {string} dirPath - Directory path to create
 * @returns {boolean} - True if created, false if already exists
 */
function createDirectory(dirPath) {
  const fullPath = path.resolve(dirPath);

  if (fs.existsSync(fullPath)) {
    return false;
  }

  try {
    fs.mkdirSync(fullPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Error creating directory ${fullPath}:`, error.message);
    throw error;
  }
}

/**
 * Creates a file with content
 * @param {string} filePath - File path to create
 * @param {string} content - File content
 * @returns {boolean} - True if created, false if already exists
 */
function createFile(filePath, content = '') {
  const fullPath = path.resolve(filePath);
  const dir = path.dirname(fullPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(fullPath)) {
    return false;
  }

  try {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Error creating file ${fullPath}:`, error.message);
    throw error;
  }
}

/**
 * Scaffolds a single phase
 * @param {number} phaseNumber - Phase number (2-5)
 * @returns {object} - Results of scaffolding
 */
function scaffoldPhase(phaseNumber) {
  const config = phaseConfigs[phaseNumber];

  if (!config) {
    throw new Error(`Invalid phase number: ${phaseNumber}. Valid phases are 2-5.`);
  }

  console.log(`\n${colors.blue}►${colors.reset} Scaffolding Phase ${phaseNumber}: ${colors.yellow}${config.name}${colors.reset}`);

  const results = {
    phase: phaseNumber,
    name: config.name,
    directoriesCreated: [],
    directoriesExisted: [],
    filesCreated: [],
    filesExisted: []
  };

  // Create main directories
  config.directories.forEach(dir => {
    const dirPath = path.join(config.basePath, dir);
    if (createDirectory(dirPath)) {
      results.directoriesCreated.push(dirPath);
      console.log(`  ${colors.green}✓${colors.reset} Created directory: ${colors.gray}${dirPath}${colors.reset}`);
    } else {
      results.directoriesExisted.push(dirPath);
      console.log(`  ${colors.gray}○ Directory exists: ${dirPath}${colors.reset}`);
    }
  });

  // Create .gitkeep files
  config.gitkeepPaths.forEach(gitkeepPath => {
    const filePath = path.join(config.basePath, gitkeepPath);
    if (createFile(filePath, '')) {
      results.filesCreated.push(filePath);
      console.log(`  ${colors.green}✓${colors.reset} Created .gitkeep: ${colors.gray}${filePath}${colors.reset}`);
    } else {
      results.filesExisted.push(filePath);
      console.log(`  ${colors.gray}○ File exists: ${filePath}${colors.reset}`);
    }
  });

  // Create placeholder files
  if (config.placeholderFiles) {
    config.placeholderFiles.forEach(file => {
      const filePath = path.join(config.basePath, file.path);
      if (createFile(filePath, file.content)) {
        results.filesCreated.push(filePath);
        console.log(`  ${colors.green}✓${colors.reset} Created placeholder: ${colors.gray}${filePath}${colors.reset}`);
      } else {
        results.filesExisted.push(filePath);
        console.log(`  ${colors.gray}○ File exists: ${filePath}${colors.reset}`);
      }
    });
  }

  // Handle additional paths (like Phase 5's e2e directory)
  if (config.additionalPaths) {
    config.additionalPaths.forEach(additional => {
      if (createDirectory(additional.basePath)) {
        results.directoriesCreated.push(additional.basePath);
        console.log(`  ${colors.green}✓${colors.reset} Created directory: ${colors.gray}${additional.basePath}${colors.reset}`);
      } else {
        results.directoriesExisted.push(additional.basePath);
        console.log(`  ${colors.gray}○ Directory exists: ${additional.basePath}${colors.reset}`);
      }

      if (additional.gitkeep) {
        const gitkeepPath = path.join(additional.basePath, '.gitkeep');
        if (createFile(gitkeepPath, '')) {
          results.filesCreated.push(gitkeepPath);
          console.log(`  ${colors.green}✓${colors.reset} Created .gitkeep: ${colors.gray}${gitkeepPath}${colors.reset}`);
        } else {
          results.filesExisted.push(gitkeepPath);
          console.log(`  ${colors.gray}○ File exists: ${gitkeepPath}${colors.reset}`);
        }
      }
    });
  }

  // Summary for this phase
  const totalCreated = results.directoriesCreated.length + results.filesCreated.length;
  const totalExisted = results.directoriesExisted.length + results.filesExisted.length;

  if (totalCreated > 0) {
    console.log(`  ${colors.green}✅ Phase ${phaseNumber} scaffolding complete:${colors.reset} ${totalCreated} items created`);
  } else {
    console.log(`  ${colors.yellow}✅ Phase ${phaseNumber} already scaffolded:${colors.reset} ${totalExisted} items exist`);
  }

  return results;
}

/**
 * Main execution function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`${colors.red}Error:${colors.reset} Please specify a phase number (2-5) or 'all'`);
    console.log('\nUsage:');
    console.log('  node scripts/scaffold-phase.js <phase-number>');
    console.log('  node scripts/scaffold-phase.js all');
    console.log('\nExamples:');
    console.log('  node scripts/scaffold-phase.js 2     # Create Phase 2 directories');
    console.log('  node scripts/scaffold-phase.js all   # Create all phase directories');
    process.exit(1);
  }

  const arg = args[0].toLowerCase();

  try {
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}  Okaeri Resort System - Phase Scaffolding Tool${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

    let allResults = [];

    if (arg === 'all') {
      // Scaffold all phases
      for (let phase = 2; phase <= 5; phase++) {
        const results = scaffoldPhase(phase);
        allResults.push(results);
      }
    } else {
      // Scaffold specific phase
      const phaseNumber = parseInt(arg, 10);

      if (isNaN(phaseNumber) || phaseNumber < 2 || phaseNumber > 5) {
        throw new Error(`Invalid phase number: ${arg}. Valid phases are 2-5 or 'all'.`);
      }

      const results = scaffoldPhase(phaseNumber);
      allResults.push(results);
    }

    // Print final summary
    console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Scaffolding Complete!${colors.reset}`);

    const totalDirsCreated = allResults.reduce((sum, r) => sum + r.directoriesCreated.length, 0);
    const totalFilesCreated = allResults.reduce((sum, r) => sum + r.filesCreated.length, 0);
    const totalDirsExisted = allResults.reduce((sum, r) => sum + r.directoriesExisted.length, 0);
    const totalFilesExisted = allResults.reduce((sum, r) => sum + r.filesExisted.length, 0);

    console.log(`\nSummary:`);
    if (totalDirsCreated > 0) {
      console.log(`  ${colors.green}►${colors.reset} Directories created: ${totalDirsCreated}`);
    }
    if (totalFilesCreated > 0) {
      console.log(`  ${colors.green}►${colors.reset} Files created: ${totalFilesCreated}`);
    }
    if (totalDirsExisted > 0) {
      console.log(`  ${colors.gray}►${colors.reset} Directories already existed: ${totalDirsExisted}`);
    }
    if (totalFilesExisted > 0) {
      console.log(`  ${colors.gray}►${colors.reset} Files already existed: ${totalFilesExisted}`);
    }

    console.log(`\nNext steps:`);
    console.log(`  1. Run ${colors.yellow}npm test:phase<number>${colors.reset} to verify empty test suites`);
    console.log(`  2. Begin TDD implementation for active phases`);
    console.log(`  3. See ${colors.blue}docs/implementation/phases/${colors.reset} for phase documentation`);

    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}✗ Scaffolding failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Check if running directly (not imported as module)
if (require.main === module) {
  main();
}

// Export functions for potential reuse
module.exports = {
  scaffoldPhase,
  createDirectory,
  createFile,
  phaseConfigs
};
