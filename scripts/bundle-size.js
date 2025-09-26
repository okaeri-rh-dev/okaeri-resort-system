#!/usr/bin/env node

/**
 * Bundle Size Validation Script
 * Validates that the production bundle meets size requirements
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MAX_BUNDLE_SIZE = 500 * 1024; // 500KB gzipped total
const MAX_CHUNK_SIZE = 200 * 1024; // 200KB per chunk
const MAX_INITIAL_LOAD = 350 * 1024; // 350KB initial load

const CRITICAL_CHUNKS = ["vendor-react", "app"]; // Must load initially

class BundleSizeValidator {
  constructor() {
    this.results = {
      totalSize: 0,
      totalGzipped: 0,
      chunks: [],
      violations: [],
      warnings: [],
      criticalSize: 0,
    };
  }

  async run() {
    console.log("🔍 Bundle Size Validation\n");

    // Build the project first
    console.log("📦 Building production bundle...");
    try {
      execSync("npm run build", { stdio: "inherit" });
    } catch (error) {
      console.error("❌ Build failed:", error.message);
      process.exit(1);
    }

    // Analyze bundle
    console.log("\n📊 Analyzing bundle sizes...\n");
    await this.analyzeBundle();

    // Report results
    this.reportResults();

    // Exit with error if violations found
    if (this.results.violations.length > 0) {
      process.exit(1);
    }
  }

  async analyzeBundle() {
    const distPath = path.join(__dirname, "..", "dist");
    const assetsPath = path.join(distPath, "assets");

    if (!fs.existsSync(assetsPath)) {
      console.error("❌ Build output not found. Run build first.");
      process.exit(1);
    }

    const files = fs.readdirSync(assetsPath);

    for (const file of files) {
      if (file.endsWith(".js") || file.endsWith(".css")) {
        const filePath = path.join(assetsPath, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath);
        const gzipped = gzipSync(content);

        const chunkInfo = {
          name: file,
          size: stats.size,
          gzipped: gzipped.length,
          isCritical: this.isCriticalChunk(file),
        };

        this.results.chunks.push(chunkInfo);
        this.results.totalSize += chunkInfo.size;
        this.results.totalGzipped += chunkInfo.gzipped;

        if (chunkInfo.isCritical) {
          this.results.criticalSize += chunkInfo.gzipped;
        }

        // Check chunk size limit
        if (chunkInfo.gzipped > MAX_CHUNK_SIZE) {
          this.results.violations.push({
            type: "CHUNK_TOO_LARGE",
            file: file,
            size: chunkInfo.gzipped,
            limit: MAX_CHUNK_SIZE,
          });
        } else if (chunkInfo.gzipped > MAX_CHUNK_SIZE * 0.8) {
          this.results.warnings.push({
            type: "CHUNK_NEAR_LIMIT",
            file: file,
            size: chunkInfo.gzipped,
            limit: MAX_CHUNK_SIZE,
          });
        }
      }
    }

    // Check total bundle size
    if (this.results.totalGzipped > MAX_BUNDLE_SIZE) {
      this.results.violations.push({
        type: "TOTAL_TOO_LARGE",
        size: this.results.totalGzipped,
        limit: MAX_BUNDLE_SIZE,
      });
    }

    // Check initial load size
    if (this.results.criticalSize > MAX_INITIAL_LOAD) {
      this.results.violations.push({
        type: "INITIAL_LOAD_TOO_LARGE",
        size: this.results.criticalSize,
        limit: MAX_INITIAL_LOAD,
      });
    }
  }

  isCriticalChunk(filename) {
    // Check if chunk is critical for initial load
    return (
      CRITICAL_CHUNKS.some((chunk) => filename.includes(chunk)) ||
      filename.includes("index") ||
      filename.endsWith(".css")
    );
  }

  reportResults() {
    console.log("📦 Bundle Size Report\n");
    console.log("─".repeat(60));

    // Total sizes
    console.log(`Total Size (raw):     ${this.formatSize(this.results.totalSize)}`);
    console.log(
      `Total Size (gzipped): ${this.formatSize(this.results.totalGzipped)} ${this.getSizeEmoji(this.results.totalGzipped, MAX_BUNDLE_SIZE)}`
    );
    console.log(
      `Initial Load Size:    ${this.formatSize(this.results.criticalSize)} ${this.getSizeEmoji(this.results.criticalSize, MAX_INITIAL_LOAD)}`
    );

    console.log("\n📊 Chunk Breakdown:\n");

    // Sort chunks by size
    const sortedChunks = [...this.results.chunks].sort((a, b) => b.gzipped - a.gzipped);

    // Display top 10 chunks
    sortedChunks.slice(0, 10).forEach((chunk) => {
      const emoji = this.getSizeEmoji(chunk.gzipped, MAX_CHUNK_SIZE);
      const critical = chunk.isCritical ? "🔴" : "⚪";
      console.log(
        `${critical} ${chunk.name.padEnd(40)} ${this.formatSize(chunk.gzipped).padStart(10)} ${emoji}`
      );
    });

    if (sortedChunks.length > 10) {
      console.log(`   ... and ${sortedChunks.length - 10} more chunks`);
    }

    // Warnings
    if (this.results.warnings.length > 0) {
      console.log("\n⚠️  Warnings:\n");
      this.results.warnings.forEach((warning) => {
        if (warning.type === "CHUNK_NEAR_LIMIT") {
          console.log(
            `   ${warning.file} is ${Math.round((warning.size / warning.limit) * 100)}% of chunk size limit`
          );
        }
      });
    }

    // Violations
    if (this.results.violations.length > 0) {
      console.log("\n❌ Violations:\n");
      this.results.violations.forEach((violation) => {
        switch (violation.type) {
          case "CHUNK_TOO_LARGE":
            console.log(
              `   ${violation.file} exceeds chunk limit (${this.formatSize(violation.size)} > ${this.formatSize(violation.limit)})`
            );
            break;
          case "TOTAL_TOO_LARGE":
            console.log(
              `   Total bundle exceeds limit (${this.formatSize(violation.size)} > ${this.formatSize(violation.limit)})`
            );
            break;
          case "INITIAL_LOAD_TOO_LARGE":
            console.log(
              `   Initial load exceeds limit (${this.formatSize(violation.size)} > ${this.formatSize(violation.limit)})`
            );
            break;
        }
      });

      console.log("\n💡 Suggestions to reduce bundle size:");
      console.log("   1. Check for duplicate dependencies");
      console.log("   2. Use dynamic imports for non-critical routes");
      console.log("   3. Consider lighter alternatives for large libraries");
      console.log("   4. Remove unused code and dependencies");
      console.log("   5. Run: npm run build:analyze to see detailed breakdown");
    } else {
      console.log("\n✅ All bundle size checks passed!");
    }

    console.log("\n─".repeat(60));
    console.log("\nRun `npm run build:analyze` for detailed visualization");
  }

  formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  getSizeEmoji(size, limit) {
    const percentage = (size / limit) * 100;
    if (percentage < 50) return "✅";
    if (percentage < 80) return "🟡";
    if (percentage < 100) return "🟠";
    return "🔴";
  }
}

// Run the validator
const validator = new BundleSizeValidator();
validator.run().catch(console.error);
