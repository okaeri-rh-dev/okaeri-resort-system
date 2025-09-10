#!/usr/bin/env node
/**
 * Phase 5.3: PWA Icon Generation Script
 * Generates optimized icons for PWA manifest
 */

const fs = require('fs');
const path = require('path');

console.log('🎨 Phase 5.3: Generating PWA Icons\n');
console.log('=' .repeat(60));

// Icon sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✅ Created icons directory');
}

// Create screenshots directory
const screenshotsDir = path.join(__dirname, '../public/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  console.log('✅ Created screenshots directory');
}

// Generate placeholder SVG icon (since we don't have sharp installed yet)
const createPlaceholderIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0EA5E9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0284C7;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}" />
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold" fill="white" text-anchor="middle">O</text>
  <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="${size * 0.12}" fill="white" text-anchor="middle">RESORT</text>
</svg>`;
};

// Generate icons
console.log('\n📱 Generating PWA Icons:');
iconSizes.forEach(size => {
  const svgContent = createPlaceholderIcon(size);
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, fileName);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`  ✅ Generated ${fileName}`);
});

// Generate maskable icon (with safe zone)
const createMaskableIcon = (size) => {
  const safeZone = size * 0.1; // 10% safe zone on each side
  const contentSize = size - (safeZone * 2);
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-mask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0EA5E9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0284C7;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Full background for maskable area -->
  <rect width="${size}" height="${size}" fill="url(#grad-mask)" />
  <!-- Content within safe zone -->
  <g transform="translate(${safeZone}, ${safeZone})">
    <rect width="${contentSize}" height="${contentSize}" fill="none" />
    <text x="${contentSize/2}" y="${contentSize * 0.4}" font-family="Arial, sans-serif" font-size="${contentSize * 0.3}" font-weight="bold" fill="white" text-anchor="middle">O</text>
    <text x="${contentSize/2}" y="${contentSize * 0.65}" font-family="Arial, sans-serif" font-size="${contentSize * 0.12}" fill="white" text-anchor="middle">RESORT</text>
  </g>
</svg>`;
};

// Generate maskable icons
console.log('\n🎭 Generating Maskable Icons:');
[192, 512].forEach(size => {
  const svgContent = createMaskableIcon(size);
  const fileName = `icon-maskable-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, fileName);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`  ✅ Generated ${fileName}`);
});

// Create placeholder screenshots
const createScreenshotPlaceholder = (width, height, label) => {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0F172A;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1E293B;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg-grad)" />
  
  <!-- Header -->
  <rect x="0" y="0" width="${width}" height="60" fill="#0EA5E9" opacity="0.1" />
  
  <!-- Logo -->
  <text x="30" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0EA5E9">Okaeri Resort</text>
  
  <!-- Dashboard Cards -->
  <rect x="30" y="90" width="${width * 0.28}" height="120" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
  <rect x="${width * 0.35}" y="90" width="${width * 0.28}" height="120" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
  <rect x="${width * 0.7}" y="90" width="${width * 0.28}" height="120" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
  
  <!-- Label -->
  <text x="${width/2}" y="${height - 30}" font-family="Arial, sans-serif" font-size="18" fill="#64748B" text-anchor="middle">${label}</text>
</svg>`;
};

// Generate screenshots
console.log('\n📸 Generating Screenshots:');
const screenshots = [
  { width: 1280, height: 720, name: 'dashboard.svg', label: 'Dashboard Overview' },
  { width: 390, height: 844, name: 'mobile-dashboard.svg', label: 'Mobile Dashboard' },
];

screenshots.forEach(({ width, height, name, label }) => {
  const svgContent = createScreenshotPlaceholder(width, height, label);
  const filePath = path.join(screenshotsDir, name);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`  ✅ Generated ${name} (${width}x${height})`);
});

// Update manifest.json
console.log('\n📝 Updating PWA Manifest...');
const manifestPath = path.join(__dirname, '../public/manifest.json');
const manifest = {
  name: "Okaeri Resort System",
  short_name: "Okaeri Resort",
  description: "Internal resort management system for staff operations",
  theme_color: "#0EA5E9",
  background_color: "#0F172A",
  display: "standalone",
  orientation: "portrait-primary",
  start_url: "/dashboard",
  scope: "/",
  icons: iconSizes.map(size => ({
    src: `/icons/icon-${size}x${size}.svg`,
    sizes: `${size}x${size}`,
    type: "image/svg+xml",
    purpose: "any"
  })).concat([
    {
      src: "/icons/icon-maskable-192x192.svg",
      sizes: "192x192",
      type: "image/svg+xml",
      purpose: "maskable"
    },
    {
      src: "/icons/icon-maskable-512x512.svg",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "maskable"
    }
  ]),
  screenshots: [
    {
      src: "/screenshots/dashboard.svg",
      sizes: "1280x720",
      type: "image/svg+xml",
      form_factor: "wide",
      label: "Dashboard Overview"
    },
    {
      src: "/screenshots/mobile-dashboard.svg",
      sizes: "390x844",
      type: "image/svg+xml",
      form_factor: "narrow",
      label: "Mobile Dashboard"
    }
  ],
  categories: ["business", "productivity"],
  prefer_related_applications: false,
  related_applications: []
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('  ✅ Updated manifest.json');

console.log('\n' + '=' .repeat(60));
console.log('✅ PWA assets generated successfully!');
console.log('\n💡 Next Steps:');
console.log('  1. Replace SVG placeholders with actual PNG/WebP images');
console.log('  2. Install sharp for server-side image optimization');
console.log('  3. Generate actual screenshots from the running app');
console.log('  4. Test PWA installation on mobile devices');