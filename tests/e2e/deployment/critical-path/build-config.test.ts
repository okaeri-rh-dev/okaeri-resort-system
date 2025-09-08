/**
 * Build configuration validation tests for deployment pipeline
 * Tests Vite production builds and deployment readiness
 */

import { describe, test, expect, beforeAll } from "vitest";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

describe("Build Configuration Validation", () => {
  let buildStats: any = {};
  let buildOutput: string[] = [];

  beforeAll(async () => {
    // Clean previous build
    try {
      await fs.rm(path.join(process.cwd(), "dist"), { recursive: true });
    } catch {
      // Directory might not exist
    }

    // Build the application
    const buildProcess = spawn("npm", ["run", "build"], {
      stdio: "pipe",
      cwd: process.cwd(),
    });

    buildProcess.stdout?.on("data", (data) => {
      buildOutput.push(data.toString());
    });

    buildProcess.stderr?.on("data", (data) => {
      buildOutput.push(`ERROR: ${data.toString()}`);
    });

    await new Promise((resolve, reject) => {
      buildProcess.on("close", (code) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`Build failed with code ${code}. Output: ${buildOutput.join("\n")}`));
        }
      });
    });

    // Parse build output for statistics
    buildStats = await analyzeBuildOutput();
  });

  describe("Build Success", () => {
    test("should build without errors", async () => {
      const hasErrors = buildOutput.some(
        (line) => line.includes("ERROR:") || line.includes("Build failed") || line.includes("✘")
      );

      expect(hasErrors).toBe(false);
    });

    test("should generate required build artifacts", async () => {
      const distPath = path.join(process.cwd(), "dist");

      // Check if dist directory exists
      const distExists = await fs
        .access(distPath)
        .then(() => true)
        .catch(() => false);
      expect(distExists).toBe(true);

      // Check for index.html
      const indexExists = await fs
        .access(path.join(distPath, "index.html"))
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);

      // Check for assets directory
      const assetsPath = path.join(distPath, "assets");
      const assetsExists = await fs
        .access(assetsPath)
        .then(() => true)
        .catch(() => false);
      expect(assetsExists).toBe(true);

      // Check for JavaScript bundles
      const assets = await fs.readdir(assetsPath);
      const jsFiles = assets.filter((file) => file.endsWith(".js"));
      const cssFiles = assets.filter((file) => file.endsWith(".css"));

      expect(jsFiles.length).toBeGreaterThan(0);
      expect(cssFiles.length).toBeGreaterThan(0);
    });

    test("should have proper file naming for caching", async () => {
      const assetsPath = path.join(process.cwd(), "dist", "assets");
      const assets = await fs.readdir(assetsPath);

      // Check that files have hash suffixes for cache busting
      const jsFiles = assets.filter((file) => file.endsWith(".js"));
      const cssFiles = assets.filter((file) => file.endsWith(".css"));

      // Modern bundlers should include hashes in filenames
      jsFiles.forEach((file) => {
        expect(file).toMatch(/^[a-zA-Z0-9_-]+\.[a-f0-9]{8,}\.(js|mjs)$/);
      });

      cssFiles.forEach((file) => {
        expect(file).toMatch(/^[a-zA-Z0-9_-]+\.[a-f0-9]{8,}\.css$/);
      });
    });
  });

  describe("Bundle Size Validation", () => {
    test("should meet bundle size requirements", async () => {
      const assetsPath = path.join(process.cwd(), "dist", "assets");
      const assets = await fs.readdir(assetsPath);

      let totalSize = 0;
      let mainBundleSize = 0;
      let vendorBundleSize = 0;

      for (const asset of assets) {
        if (asset.endsWith(".js") || asset.endsWith(".mjs")) {
          const filePath = path.join(assetsPath, asset);
          const stats = await fs.stat(filePath);
          const sizeKB = Math.round(stats.size / 1024);

          totalSize += sizeKB;

          if (asset.includes("index")) {
            mainBundleSize += sizeKB;
          } else if (asset.includes("vendor") || asset.includes("chunk")) {
            vendorBundleSize += sizeKB;
          }
        }
      }

      // Bundle size requirements (in KB)
      const MAX_TOTAL_SIZE = 500; // 500KB total
      const MAX_MAIN_SIZE = 200; // 200KB main bundle
      const MAX_VENDOR_SIZE = 300; // 300KB vendor bundle

      expect(totalSize).toBeLessThanOrEqual(MAX_TOTAL_SIZE);
      expect(mainBundleSize).toBeLessThanOrEqual(MAX_MAIN_SIZE);

      console.log(
        `Bundle sizes - Total: ${totalSize}KB, Main: ${mainBundleSize}KB, Vendor: ${vendorBundleSize}KB`
      );
    });

    test("should have effective code splitting", async () => {
      const assetsPath = path.join(process.cwd(), "dist", "assets");
      const assets = await fs.readdir(assetsPath);
      const jsFiles = assets.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));

      // Should have multiple JS chunks for code splitting
      expect(jsFiles.length).toBeGreaterThanOrEqual(2);

      // Verify different types of chunks exist
      const hasMainChunk = jsFiles.some((file) => file.includes("index"));
      const hasVendorChunk = jsFiles.some(
        (file) => file.includes("vendor") || file.includes("chunk")
      );

      expect(hasMainChunk || hasVendorChunk).toBe(true);
    });

    test("should compress assets appropriately", async () => {
      const assetsPath = path.join(process.cwd(), "dist", "assets");
      const assets = await fs.readdir(assetsPath);

      // Check if CSS is minified (should not have excessive whitespace)
      const cssFiles = assets.filter((file) => file.endsWith(".css"));

      for (const cssFile of cssFiles) {
        const content = await fs.readFile(path.join(assetsPath, cssFile), "utf-8");

        // Minified CSS should have minimal whitespace
        const whitespaceRatio = content.match(/\s/g)?.length / content.length || 0;
        expect(whitespaceRatio).toBeLessThan(0.1); // Less than 10% whitespace
      }

      // Check if JS is minified (should not have excessive comments or whitespace)
      const jsFiles = assets.filter((file) => file.endsWith(".js"));

      for (const jsFile of jsFiles.slice(0, 2)) {
        // Check first 2 JS files
        const content = await fs.readFile(path.join(assetsPath, jsFile), "utf-8");

        // Should not contain development comments
        expect(content).not.toMatch(/\/\*[\s\S]*?\*\//g);
        expect(content).not.toMatch(/\/\/.*$/gm);
      }
    });
  });

  describe("TypeScript Compilation", () => {
    test("should compile TypeScript without errors", async () => {
      const hasTypeErrors = buildOutput.some(
        (line) =>
          (line.includes("TS") && line.includes("error")) ||
          (line.includes("TypeScript") && line.includes("error"))
      );

      expect(hasTypeErrors).toBe(false);
    });

    test("should generate proper source maps for production", async () => {
      const assetsPath = path.join(process.cwd(), "dist", "assets");
      const assets = await fs.readdir(assetsPath);
      const jsFiles = assets.filter((file) => file.endsWith(".js"));

      // Check if source maps are generated (optional in production)
      const sourceMapFiles = assets.filter((file) => file.endsWith(".js.map"));

      // If source maps are disabled in production, that's also valid
      if (sourceMapFiles.length > 0) {
        expect(sourceMapFiles.length).toBe(jsFiles.length);
      }

      console.log(`Source maps generated: ${sourceMapFiles.length}/${jsFiles.length}`);
    });
  });

  describe("Asset Optimization", () => {
    test("should optimize images and static assets", async () => {
      const distPath = path.join(process.cwd(), "dist");

      // Check if images are optimized (look for common image formats)
      const allFiles = await getAllFiles(distPath);
      const imageFiles = allFiles.filter((file) =>
        /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(file)
      );

      for (const imageFile of imageFiles.slice(0, 5)) {
        // Check first 5 images
        const stats = await fs.stat(imageFile);
        const sizeKB = Math.round(stats.size / 1024);

        // Images should be reasonably sized (less than 500KB each)
        expect(sizeKB).toBeLessThan(500);
      }

      console.log(`Image files found: ${imageFiles.length}`);
    });

    test("should generate proper manifest files", async () => {
      const distPath = path.join(process.cwd(), "dist");

      // Check for PWA manifest
      const manifestPath = path.join(distPath, "manifest.json");
      const manifestExists = await fs
        .access(manifestPath)
        .then(() => true)
        .catch(() => false);

      if (manifestExists) {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

        expect(manifest.name).toBeDefined();
        expect(manifest.start_url).toBeDefined();
        expect(manifest.icons).toBeDefined();
        expect(Array.isArray(manifest.icons)).toBe(true);
      }

      // Check for Vite manifest (if generated)
      const viteManifestPath = path.join(distPath, ".vite", "manifest.json");
      const viteManifestExists = await fs
        .access(viteManifestPath)
        .then(() => true)
        .catch(() => false);

      console.log(`PWA manifest: ${manifestExists}, Vite manifest: ${viteManifestExists}`);
    });
  });

  describe("Environment Configuration", () => {
    test("should include only production environment variables", async () => {
      const indexPath = path.join(process.cwd(), "dist", "index.html");
      const indexContent = await fs.readFile(indexPath, "utf-8");

      // Should not contain development environment indicators
      expect(indexContent).not.toContain("localhost:3000");
      expect(indexContent).not.toContain("development");
      expect(indexContent).not.toContain("NODE_ENV=dev");
    });

    test("should have proper meta tags for production", async () => {
      const indexPath = path.join(process.cwd(), "dist", "index.html");
      const indexContent = await fs.readFile(indexPath, "utf-8");

      // Check for essential meta tags
      expect(indexContent).toContain('<meta charset="utf-8"');
      expect(indexContent).toContain("viewport");
      expect(indexContent).toContain("<title>");

      // Should have security headers if configured
      if (indexContent.includes("Content-Security-Policy")) {
        expect(indexContent).toMatch(/Content-Security-Policy.*default-src/);
      }
    });
  });
});

/**
 * Analyze build output to extract statistics
 */
async function analyzeBuildOutput(): Promise<any> {
  const distPath = path.join(process.cwd(), "dist");

  try {
    const assetsPath = path.join(distPath, "assets");
    const assets = await fs.readdir(assetsPath);

    let totalSize = 0;
    const fileTypes: Record<string, number> = {};

    for (const asset of assets) {
      const filePath = path.join(assetsPath, asset);
      const stats = await fs.stat(filePath);
      const ext = path.extname(asset).toLowerCase();

      totalSize += stats.size;
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    }

    return {
      totalSize,
      fileTypes,
      assetCount: assets.length,
    };
  } catch (error) {
    return {
      totalSize: 0,
      fileTypes: {},
      assetCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
      console.warn(`Could not scan directory ${currentDir}:`, error);
    }
  }

  await scan(dir);
  return files;
}
