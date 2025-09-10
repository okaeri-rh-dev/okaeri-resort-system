#!/usr/bin/env node
/**
 * Phase 5.3: Local Lighthouse Testing Script
 * Runs comprehensive performance tests for development
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const REPORTS_DIR = './reports/lighthouse';
const WAIT_TIMEOUT = 30000; // 30 seconds

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🚀 Phase 5.3: Running Local Lighthouse Performance Tests\n');

// Test URLs specific to Okaeri Resort System
const TEST_URLS = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/bookings', name: 'bookings' },
  { path: '/expenses', name: 'expenses' },
  { path: '/reports', name: 'reports' },
];

// Philippine network conditions simulation
const NETWORK_CONDITIONS = {
  mobile: {
    name: 'Philippine Mobile (4G)',
    throttling: {
      rttMs: 150,
      throughputKbps: 1600,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
    },
  },
  desktop: {
    name: 'Philippine Desktop (Fiber)',
    throttling: {
      rttMs: 40,
      throughputKbps: 10000,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
    },
  },
};

async function buildProject() {
  console.log('📦 Building project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed\n');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

async function startPreviewServer() {
  console.log(`🌐 Starting preview server on port ${PREVIEW_PORT}...`);
  
  const serverProcess = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    detached: false,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Server startup timeout'));
    }, WAIT_TIMEOUT);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes(`${PREVIEW_PORT}`)) {
        clearTimeout(timeout);
        console.log('✅ Preview server started\n');
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function waitForServer() {
  console.log('⏳ Waiting for server to be ready...');
  
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(PREVIEW_URL);
      if (response.ok) {
        console.log('✅ Server is ready\n');
        return;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Server failed to respond after 30 seconds');
}

function generateLighthouseConfig(device) {
  const config = NETWORK_CONDITIONS[device];
  
  return {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: device,
      throttling: {
        rttMs: config.throttling.rttMs,
        throughputKbps: config.throttling.throughputKbps,
        requestLatencyMs: config.throttling.rttMs,
        downloadThroughputKbps: config.throttling.throughputKbps,
        uploadThroughputKbps: Math.floor(config.throttling.throughputKbps * 0.5),
        cpuSlowdownMultiplier: config.throttling.cpuSlowdownMultiplier,
      },
      screenEmulation: config.screenEmulation,
      emulatedUserAgent: device === 'mobile'
        ? 'Mozilla/5.0 (Linux; Android 11; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    },
  };
}

async function runLighthouseTests() {
  const devices = ['mobile', 'desktop'];
  const results = {};

  for (const device of devices) {
    console.log(`\n📱 Testing on ${NETWORK_CONDITIONS[device].name}...`);
    results[device] = {};

    for (const url of TEST_URLS) {
      const testUrl = `${PREVIEW_URL}${url.path}`;
      const outputPath = path.join(REPORTS_DIR, `${url.name}-${device}.json`);
      const htmlPath = path.join(REPORTS_DIR, `${url.name}-${device}.html`);

      console.log(`  🔍 Testing ${url.path}...`);

      try {
        // Create temporary config file
        const configPath = path.join(REPORTS_DIR, `config-${device}.json`);
        fs.writeFileSync(configPath, JSON.stringify(generateLighthouseConfig(device), null, 2));

        // Run Lighthouse
        const command = [
          'npx lighthouse',
          `"${testUrl}"`,
          `--config-path="${configPath}"`,
          `--output=json,html`,
          `--output-path="${outputPath.replace('.json', '')}"`,
          '--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"',
          '--quiet',
        ].join(' ');

        execSync(command, { stdio: 'pipe' });

        // Read and parse results
        const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        const scores = {
          performance: Math.round(report.categories.performance.score * 100),
          accessibility: Math.round(report.categories.accessibility.score * 100),
          bestPractices: Math.round(report.categories['best-practices'].score * 100),
          seo: Math.round(report.categories.seo.score * 100),
        };

        const metrics = {
          fcp: Math.round(report.audits['first-contentful-paint'].numericValue),
          lcp: Math.round(report.audits['largest-contentful-paint'].numericValue),
          cls: report.audits['cumulative-layout-shift'].numericValue.toFixed(3),
          inp: Math.round(report.audits['interaction-to-next-paint']?.numericValue || 0),
          tbt: Math.round(report.audits['total-blocking-time'].numericValue),
          si: Math.round(report.audits['speed-index'].numericValue),
        };

        results[device][url.name] = { scores, metrics };

        // Format results
        const perfEmoji = scores.performance >= 90 ? '🟢' : scores.performance >= 70 ? '🟡' : '🔴';
        console.log(`    ${perfEmoji} Performance: ${scores.performance}% | LCP: ${metrics.lcp}ms | FCP: ${metrics.fcp}ms | CLS: ${metrics.cls}`);

        // Clean up config file
        fs.unlinkSync(configPath);

      } catch (error) {
        console.error(`    ❌ Failed to test ${url.path}:`, error.message);
        results[device][url.name] = { error: error.message };
      }
    }
  }

  return results;
}

function generateSummaryReport(results) {
  console.log('\n📊 Performance Test Summary');
  console.log('═'.repeat(80));

  const devices = Object.keys(results);
  
  for (const device of devices) {
    console.log(`\n${NETWORK_CONDITIONS[device].name}:`);
    console.log('-'.repeat(50));

    const deviceResults = results[device];
    let totalPerf = 0;
    let validTests = 0;

    for (const [pageName, result] of Object.entries(deviceResults)) {
      if (result.error) {
        console.log(`  ❌ ${pageName}: ${result.error}`);
        continue;
      }

      const { scores, metrics } = result;
      totalPerf += scores.performance;
      validTests++;

      const perfEmoji = scores.performance >= 90 ? '🟢' : scores.performance >= 70 ? '🟡' : '🔴';
      const lcpStatus = metrics.lcp <= 2500 ? '✅' : '⚠️';
      const fcpStatus = metrics.fcp <= 1800 ? '✅' : '⚠️';
      const clsStatus = parseFloat(metrics.cls) <= 0.1 ? '✅' : '⚠️';

      console.log(`  ${perfEmoji} ${pageName.padEnd(12)} | Perf: ${scores.performance}% | LCP: ${metrics.lcp}ms ${lcpStatus} | FCP: ${metrics.fcp}ms ${fcpStatus} | CLS: ${metrics.cls} ${clsStatus}`);
    }

    if (validTests > 0) {
      const avgPerf = Math.round(totalPerf / validTests);
      const avgEmoji = avgPerf >= 90 ? '🟢' : avgPerf >= 70 ? '🟡' : '🔴';
      console.log(`\n  ${avgEmoji} Average Performance: ${avgPerf}%`);
    }
  }

  console.log('\n📁 Reports saved to:', REPORTS_DIR);
  console.log('\n🎯 Phase 5.3 Performance Targets:');
  console.log('  • Performance Score: ≥90%');
  console.log('  • First Contentful Paint: ≤1.8s');
  console.log('  • Largest Contentful Paint: ≤2.5s');
  console.log('  • Cumulative Layout Shift: ≤0.1');
  console.log('  • Interaction to Next Paint: ≤200ms');
  console.log('  • Total Blocking Time: ≤300ms');
}

async function main() {
  let serverProcess = null;

  try {
    // Build the project
    await buildProject();

    // Start preview server
    serverProcess = await startPreviewServer();

    // Wait for server to be ready
    await waitForServer();

    // Run Lighthouse tests
    const results = await runLighthouseTests();

    // Generate summary report
    generateSummaryReport(results);

    console.log('\n✅ Lighthouse testing completed!');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    process.exit(1);
  } finally {
    // Clean up server
    if (serverProcess) {
      console.log('\n🧹 Cleaning up server...');
      serverProcess.kill();
    }
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Test terminated');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}