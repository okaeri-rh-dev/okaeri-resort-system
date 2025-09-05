#!/usr/bin/env node
/**
 * Bundle Size Monitoring Script
 * Phase 2.4: Performance Optimization - Bundle size tracking and alerts
 *
 * @description Monitors bundle sizes and alerts on threshold breaches
 * for Okaeri Resort System performance budgets
 */

import fs from "fs";
import path from "path";
import { gzipSync } from "zlib";

const PERFORMANCE_BUDGETS = {
  // Bundle size budgets in KB
  totalJSGzipped: 250,
  totalJSUncompressed: 800,
  largestChunk: 300,
  mainBundle: 150,
  cssTotal: 30,
};

const DIST_PATH = path.resolve(process.cwd(), "dist");
const ASSETS_PATH = path.join(DIST_PATH, "assets");
const REPORT_PATH = path.resolve(process.cwd(), "reports");

/**
 * Get file size in KB
 */
function getFileSizeKB(filePath) {
  const stats = fs.statSync(filePath);
  return Math.round((stats.size / 1024) * 100) / 100;
}

/**
 * Get gzipped size in KB
 */
function getGzippedSizeKB(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  return Math.round((gzipped.length / 1024) * 100) / 100;
}

/**
 * Analyze bundle sizes
 */
function analyzeBundles() {
  if (!fs.existsSync(ASSETS_PATH)) {
    console.error("❌ No build found. Run `npm run build` first.");
    process.exit(1);
  }

  const jsFiles = fs
    .readdirSync(ASSETS_PATH)
    .filter((file) => file.endsWith(".js") && !file.endsWith(".map"))
    .map((file) => {
      const filePath = path.join(ASSETS_PATH, file);
      return {
        name: file,
        path: filePath,
        uncompressed: getFileSizeKB(filePath),
        gzipped: getGzippedSizeKB(filePath),
      };
    })
    .sort((a, b) => b.uncompressed - a.uncompressed);

  const cssFiles = fs
    .readdirSync(ASSETS_PATH)
    .filter((file) => file.endsWith(".css"))
    .map((file) => {
      const filePath = path.join(ASSETS_PATH, file);
      return {
        name: file,
        path: filePath,
        uncompressed: getFileSizeKB(filePath),
        gzipped: getGzippedSizeKB(filePath),
      };
    });

  return { jsFiles, cssFiles };
}

/**
 * Check performance budgets
 */
function checkBudgets(jsFiles, cssFiles) {
  const results = {
    passed: true,
    violations: [],
    warnings: [],
  };

  // Total JS sizes
  const totalJSUncompressed = jsFiles.reduce((sum, file) => sum + file.uncompressed, 0);
  const totalJSGzipped = jsFiles.reduce((sum, file) => sum + file.gzipped, 0);
  const totalCSS = cssFiles.reduce((sum, file) => sum + file.uncompressed, 0);

  // Check budgets
  if (totalJSGzipped > PERFORMANCE_BUDGETS.totalJSGzipped) {
    results.passed = false;
    results.violations.push({
      type: "Total JS (gzipped)",
      current: `${totalJSGzipped} KB`,
      budget: `${PERFORMANCE_BUDGETS.totalJSGzipped} KB`,
      overage: `+${(totalJSGzipped - PERFORMANCE_BUDGETS.totalJSGzipped).toFixed(2)} KB`,
    });
  }

  if (totalJSUncompressed > PERFORMANCE_BUDGETS.totalJSUncompressed) {
    results.violations.push({
      type: "Total JS (uncompressed)",
      current: `${totalJSUncompressed} KB`,
      budget: `${PERFORMANCE_BUDGETS.totalJSUncompressed} KB`,
      overage: `+${(totalJSUncompressed - PERFORMANCE_BUDGETS.totalJSUncompressed).toFixed(2)} KB`,
    });
  }

  // Check largest chunk
  if (jsFiles.length > 0 && jsFiles[0].uncompressed > PERFORMANCE_BUDGETS.largestChunk) {
    results.violations.push({
      type: "Largest chunk",
      current: `${jsFiles[0].uncompressed} KB (${jsFiles[0].name})`,
      budget: `${PERFORMANCE_BUDGETS.largestChunk} KB`,
      overage: `+${(jsFiles[0].uncompressed - PERFORMANCE_BUDGETS.largestChunk).toFixed(2)} KB`,
    });
  }

  // Check main bundle (look for main-* pattern)
  const mainBundle = jsFiles.find((file) => file.name.startsWith("main-"));
  if (mainBundle && mainBundle.uncompressed > PERFORMANCE_BUDGETS.mainBundle) {
    results.violations.push({
      type: "Main bundle",
      current: `${mainBundle.uncompressed} KB`,
      budget: `${PERFORMANCE_BUDGETS.mainBundle} KB`,
      overage: `+${(mainBundle.uncompressed - PERFORMANCE_BUDGETS.mainBundle).toFixed(2)} KB`,
    });
  }

  // Check CSS
  if (totalCSS > PERFORMANCE_BUDGETS.cssTotal) {
    results.violations.push({
      type: "Total CSS",
      current: `${totalCSS} KB`,
      budget: `${PERFORMANCE_BUDGETS.cssTotal} KB`,
      overage: `+${(totalCSS - PERFORMANCE_BUDGETS.cssTotal).toFixed(2)} KB`,
    });
  }

  // Warnings for approaching limits (80% of budget)
  const warnThreshold = 0.8;

  if (totalJSGzipped > PERFORMANCE_BUDGETS.totalJSGzipped * warnThreshold) {
    results.warnings.push({
      type: "Total JS (gzipped) approaching limit",
      current: `${totalJSGzipped} KB`,
      budget: `${PERFORMANCE_BUDGETS.totalJSGzipped} KB`,
      percentage: `${Math.round((totalJSGzipped / PERFORMANCE_BUDGETS.totalJSGzipped) * 100)}%`,
    });
  }

  return results;
}

/**
 * Generate bundle report
 */
function generateReport(jsFiles, cssFiles, budgetResults) {
  const totalJSUncompressed = jsFiles.reduce((sum, file) => sum + file.uncompressed, 0);
  const totalJSGzipped = jsFiles.reduce((sum, file) => sum + file.gzipped, 0);
  const totalCSS = cssFiles.reduce((sum, file) => sum + file.uncompressed, 0);

  const timestamp = new Date().toISOString();

  const report = `# Bundle Size Report

**Generated**: ${timestamp}

## Summary

| Metric | Current | Budget | Status |
|--------|---------|--------|--------|
| Total JS (gzipped) | ${totalJSGzipped} KB | ${PERFORMANCE_BUDGETS.totalJSGzipped} KB | ${totalJSGzipped <= PERFORMANCE_BUDGETS.totalJSGzipped ? "✅" : "❌"} |
| Total JS (uncompressed) | ${totalJSUncompressed} KB | ${PERFORMANCE_BUDGETS.totalJSUncompressed} KB | ${totalJSUncompressed <= PERFORMANCE_BUDGETS.totalJSUncompressed ? "✅" : "❌"} |
| Total CSS | ${totalCSS} KB | ${PERFORMANCE_BUDGETS.cssTotal} KB | ${totalCSS <= PERFORMANCE_BUDGETS.cssTotal ? "✅" : "❌"} |

## JavaScript Files

| File | Uncompressed | Gzipped | 
|------|--------------|---------|
${jsFiles.map((file) => `| ${file.name} | ${file.uncompressed} KB | ${file.gzipped} KB |`).join("\n")}

## CSS Files

| File | Size |
|------|------|
${cssFiles.length > 0 ? cssFiles.map((file) => `| ${file.name} | ${file.uncompressed} KB |`).join("\n") : "| No CSS files found | - |"}

${
  budgetResults.violations.length > 0
    ? `## ❌ Budget Violations

${budgetResults.violations.map((v) => `- **${v.type}**: ${v.current} (Budget: ${v.budget}, Overage: ${v.overage})`).join("\n")}`
    : ""
}

${
  budgetResults.warnings.length > 0
    ? `## ⚠️ Warnings

${budgetResults.warnings.map((w) => `- **${w.type}**: ${w.current} (${w.percentage} of budget)`).join("\n")}`
    : ""
}

## Recommendations

${totalJSGzipped > 200 ? "- Consider implementing more aggressive code splitting" : ""}
${jsFiles.find((f) => f.uncompressed > 200) ? "- Large chunks detected - consider breaking down further" : ""}
${budgetResults.violations.length === 0 ? "✅ All performance budgets are within limits!" : ""}
`;

  // Ensure reports directory exists
  if (!fs.existsSync(REPORT_PATH)) {
    fs.mkdirSync(REPORT_PATH, { recursive: true });
  }

  // Write report
  const reportFile = path.join(REPORT_PATH, "bundle-size-report.md");
  fs.writeFileSync(reportFile, report);

  return reportFile;
}

/**
 * Main function
 */
function main() {
  console.log("🔍 Analyzing bundle sizes...\n");

  try {
    const { jsFiles, cssFiles } = analyzeBundles();
    const budgetResults = checkBudgets(jsFiles, cssFiles);
    const reportFile = generateReport(jsFiles, cssFiles, budgetResults);

    // Console output
    console.log("📊 Bundle Analysis Results:\n");

    // Summary
    const totalJSGzipped = jsFiles.reduce((sum, file) => sum + file.gzipped, 0);
    const totalJSUncompressed = jsFiles.reduce((sum, file) => sum + file.uncompressed, 0);

    console.log(`📦 Total JS: ${totalJSUncompressed} KB (${totalJSGzipped} KB gzipped)`);
    console.log(`📄 Total CSS: ${cssFiles.reduce((sum, file) => sum + file.uncompressed, 0)} KB`);
    console.log(`📁 Report: ${reportFile}\n`);

    // Top 5 largest files
    console.log("🏆 Largest Files:");
    jsFiles.slice(0, 5).forEach((file, i) => {
      console.log(`  ${i + 1}. ${file.name}: ${file.uncompressed} KB (${file.gzipped} KB gzipped)`);
    });

    console.log("");

    // Budget results
    if (budgetResults.violations.length > 0) {
      console.log("❌ Performance Budget Violations:");
      budgetResults.violations.forEach((v) => {
        console.log(`  • ${v.type}: ${v.current} exceeds budget of ${v.budget} by ${v.overage}`);
      });
      console.log("");
    }

    if (budgetResults.warnings.length > 0) {
      console.log("⚠️ Performance Warnings:");
      budgetResults.warnings.forEach((w) => {
        console.log(`  • ${w.type}: ${w.current} (${w.percentage})`);
      });
      console.log("");
    }

    if (budgetResults.passed && budgetResults.warnings.length === 0) {
      console.log("✅ All performance budgets within limits!");
    }

    // Exit with appropriate code
    process.exit(budgetResults.violations.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Bundle analysis failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeBundles, checkBudgets, generateReport, PERFORMANCE_BUDGETS };
