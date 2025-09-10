/**
 * Phase 5.3: Image Optimization API Endpoint
 * Provides server-side image optimization with WebP conversion
 * Compatible with Vercel Edge Functions
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import sharp from "sharp";

export const config = {
  runtime: "edge",
  regions: ["sin1", "hnd1"], // Singapore primary, Tokyo fallback
};

// Allowed image domains for security
const ALLOWED_DOMAINS = [
  "localhost",
  "okaeri-resort.vercel.app",
  "res.cloudinary.com", // If using Cloudinary
  "images.unsplash.com", // For placeholder images
];

// Maximum dimensions
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const DEFAULT_QUALITY = 75;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse query parameters
    const { url, w, h, q, fm } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing image URL" });
    }

    // Security: Validate URL domain
    const imageUrl = new URL(url, `https://${req.headers.host}`);
    const isAllowed = ALLOWED_DOMAINS.some((domain) => imageUrl.hostname.includes(domain));

    if (!isAllowed) {
      return res.status(403).json({ error: "Domain not allowed" });
    }

    // Parse dimensions and quality
    const width = Math.min(parseInt(w as string) || 0, MAX_WIDTH) || undefined;
    const height = Math.min(parseInt(h as string) || 0, MAX_HEIGHT) || undefined;
    const quality = Math.min(Math.max(parseInt(q as string) || DEFAULT_QUALITY, 1), 100);

    // Determine output format
    const format = (fm as string) || "webp";
    const supportedFormats = ["jpeg", "jpg", "png", "webp", "avif"];
    const outputFormat = supportedFormats.includes(format) ? format : "webp";

    // Fetch original image
    const imageResponse = await fetch(imageUrl.toString());

    if (!imageResponse.ok) {
      return res.status(404).json({ error: "Image not found" });
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Process image with Sharp
    let pipeline = sharp(Buffer.from(imageBuffer));

    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert format and optimize
    switch (outputFormat) {
      case "jpeg":
      case "jpg":
        pipeline = pipeline.jpeg({
          quality,
          progressive: true,
          optimizeScans: true,
        });
        break;
      case "png":
        pipeline = pipeline.png({
          quality,
          compressionLevel: 9,
          progressive: true,
        });
        break;
      case "webp":
        pipeline = pipeline.webp({
          quality,
          effort: 6,
          smartSubsample: true,
        });
        break;
      case "avif":
        pipeline = pipeline.avif({
          quality,
          effort: 6,
        });
        break;
    }

    // Generate optimized image
    const optimizedBuffer = await pipeline.toBuffer();

    // Set cache headers for CDN
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.setHeader("Content-Type", `image/${outputFormat === "jpg" ? "jpeg" : outputFormat}`);
    res.setHeader("Vary", "Accept");

    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");

    // Send optimized image
    return res.status(200).send(optimizedBuffer);
  } catch (error) {
    console.error("Image optimization error:", error);
    return res.status(500).json({
      error: "Failed to optimize image",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
