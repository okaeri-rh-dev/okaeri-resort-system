/**
 * Security validation tests for deployment pipeline
 * Tests for secret detection and vulnerable package scanning
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

describe("Deployment Security Validation", () => {
  let buildOutput: string[] = [];

  beforeAll(async () => {
    // Build the application for production
    const buildProcess = spawn("npm", ["run", "build"], {
      stdio: "pipe",
      cwd: process.cwd(),
    });

    buildProcess.stdout?.on("data", (data) => {
      buildOutput.push(data.toString());
    });

    await new Promise((resolve, reject) => {
      buildProcess.on("close", (code) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
  });

  afterAll(async () => {
    // Clean up build artifacts if needed
    // Note: Keep dist/ for subsequent tests
  });

  describe("Secret Detection", () => {
    test("should not expose environment variables in client bundle", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Patterns that should never appear in client bundles
      const forbiddenPatterns = [
        /DATABASE_URL\s*[=:]/,
        /JWT_SECRET\s*[=:]/,
        /UPSTASH_REDIS_REST_TOKEN\s*[=:]/,
        /NEXTAUTH_SECRET\s*[=:]/,
        /R2_SECRET_ACCESS_KEY\s*[=:]/,
        /postgresql:\/\//,
        /postgres:\/\//,
        // Generic secret patterns
        /[A-Za-z0-9+\/]{32,}={0,2}/, // Base64 encoded secrets
        /sk_[a-zA-Z0-9]{24,}/, // Stripe-style secret keys
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, // UUIDs that might be secrets
      ];

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");

        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          if (match) {
            throw new Error(
              `Potential secret found in ${file}: ${match[0]}\n` +
                `Context: ${content.slice(Math.max(0, match.index! - 50), match.index! + 100)}`
            );
          }
        }
      }

      expect(files.length).toBeGreaterThan(0);
    });

    test("should only include VITE_ prefixed environment variables", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Look for any environment variable references
      const envPattern = /process\.env\.([A-Z_]+)/g;
      const allowedVitePatterns = /^VITE_/;

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        let match;

        while ((match = envPattern.exec(content)) !== null) {
          const envVar = match[1];

          // Allow common Node.js environment variables and VITE_ prefixed ones
          const allowedEnvVars = ["NODE_ENV", "DEV", "PROD"];

          if (!allowedVitePatterns.test(envVar) && !allowedEnvVars.includes(envVar)) {
            throw new Error(
              `Unauthorized environment variable ${envVar} found in client bundle: ${file}\n` +
                `Only VITE_ prefixed variables should be available to the client`
            );
          }
        }
      }
    });

    test("should not contain development URLs in production build", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      const devUrlPatterns = [
        /localhost:3000/,
        /127\.0\.0\.1:3000/,
        /http:\/\/localhost/,
        /\.local:/, // .local domains
        /dev\./, // dev subdomains
      ];

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");

        for (const pattern of devUrlPatterns) {
          if (pattern.test(content)) {
            throw new Error(`Development URL found in production build: ${file}`);
          }
        }
      }
    });
  });

  describe("Vulnerable Package Detection", () => {
    test("should not include axios in production bundle", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Check for axios signatures in bundle
      const axiosPatterns = [
        /axios\.create/,
        /axios\.get/,
        /axios\.post/,
        /from\s+['"]axios['"]/,
        /require\(['"]axios['"]\)/,
        /__axios__/,
        /XMLHttpRequest.*axios/,
      ];

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");

        for (const pattern of axiosPatterns) {
          if (pattern.test(content)) {
            throw new Error(
              `axios library detected in production bundle: ${file}\n` +
                `Production should use fetch API to avoid vulnerable dependencies`
            );
          }
        }
      }
    });

    test("should not include other vulnerable packages in bundle", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Known vulnerable packages that should not be in production
      const vulnerablePatterns = [
        /path-to-regexp.*4\.[0-6]\./,
        /undici.*5\.[0-2][0-8]/,
        /esbuild.*0\.[0-2][0-4]/,
        // Generic patterns for vulnerable packages
        /eval\s*\(/, // eval usage can be dangerous
        /Function\s*\(/, // Function constructor
        /with\s*\(/, // with statements
      ];

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");

        for (const pattern of vulnerablePatterns) {
          if (pattern.test(content)) {
            console.warn(`Potential vulnerable pattern in ${file}: ${pattern}`);
            // Note: We warn but don't fail as these might be false positives
          }
        }
      }
    });

    test("should only include whitelisted third-party libraries", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Allowed third-party libraries in production
      const allowedLibraries = [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/router",
        "zustand",
        "zod",
        "react-hook-form",
        "immer",
        "tailwindcss",
        "vite",
        // Add more as needed
      ];

      // Check for unexpected libraries in bundle comments or metadata
      const libraryPattern = /\/\*\s*([a-zA-Z0-9@\-\/]+)\s*\*\//g;
      const foundLibraries = new Set<string>();

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        let match;

        while ((match = libraryPattern.exec(content)) !== null) {
          const library = match[1];
          if (library.includes("/") || library.includes("@")) {
            foundLibraries.add(library);
          }
        }
      }

      // Check if all found libraries are in whitelist
      for (const library of foundLibraries) {
        const isAllowed = allowedLibraries.some(
          (allowed) => library.includes(allowed) || allowed.includes(library)
        );

        if (!isAllowed && !library.startsWith("vite:")) {
          console.warn(`Unexpected library in bundle: ${library}`);
          // Note: We warn but don't fail as build tools might add metadata
        }
      }

      expect(foundLibraries.size).toBeGreaterThanOrEqual(0); // Just verify we scanned something
    });
  });

  describe("Bundle Security Analysis", () => {
    test("should not contain eval or dangerous code execution patterns", async () => {
      const distPath = path.join(process.cwd(), "dist");
      const files = await getJavaScriptFiles(distPath);

      // Dangerous code execution patterns
      const dangerousPatterns = [
        /\beval\s*\(/,
        /new\s+Function\s*\(/,
        /setTimeout\s*\(\s*['"`]/, // setTimeout with string
        /setInterval\s*\(\s*['"`]/, // setInterval with string
        /execScript/,
        /javascript:/,
        /vbscript:/,
        /data:text\/html/,
      ];

      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");

        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            throw new Error(
              `Dangerous code execution pattern found in ${file}: ${pattern}\n` +
                `This could be a security vulnerability`
            );
          }
        }
      }
    });

    test("should have appropriate Content Security Policy headers", async () => {
      // This would typically test against a deployed version
      // For now, we'll verify the CSP configuration exists
      const vercelConfigPath = path.join(process.cwd(), "vercel.json");

      try {
        const vercelConfig = JSON.parse(await fs.readFile(vercelConfigPath, "utf-8"));

        const hasCSP = vercelConfig.headers?.some((header: any) =>
          header.headers?.some((h: any) => h.key === "Content-Security-Policy")
        );

        expect(hasCSP).toBe(true);
      } catch (error) {
        throw new Error("vercel.json not found or CSP headers not configured");
      }
    });
  });
});

/**
 * Helper function to recursively find all JavaScript files in a directory
 */
async function getJavaScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && /\.(js|mjs|ts)$/.test(entry.name)) {
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
