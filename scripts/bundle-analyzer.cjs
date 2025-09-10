#!/usr/bin/env node
/**
 * Phase 5.3: Bundle Analysis Script
 * Analyzes the production build without Vitest conflicts
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Phase 5.3: Bundle Analysis\n');
console.log('=' .repeat(60));

// Check if dist directory exists
const distPath = path.join(__dirname, '../dist');
const hasExistingBuild = fs.existsSync(distPath);

if (hasExistingBuild) {
  console.log('📦 Analyzing existing build in dist/...\n');
  
  // Get all JS files in dist/assets
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    const files = fs.readdirSync(assetsPath);
    
    // Group files by type
    const critical = files.filter(f => f.includes('critical'));
    const features = files.filter(f => f.includes('features'));
    const routes = files.filter(f => f.includes('routes'));
    const vendors = files.filter(f => f.includes('vendors'));
    const chunks = files.filter(f => f.includes('chunks'));
    
    console.log('📊 Bundle Structure:');
    console.log(`  Critical: ${critical.length} files`);
    console.log(`  Features: ${features.length} files`);
    console.log(`  Routes: ${routes.length} files`);
    console.log(`  Vendors: ${vendors.length} files`);
    console.log(`  Chunks: ${chunks.length} files`);
    console.log(`  Total: ${files.filter(f => f.endsWith('.js')).length} JS files\n`);
    
    // Calculate sizes
    let totalSize = 0;
    let criticalSize = 0;
    const chunkSizes = [];
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(assetsPath, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        
        totalSize += stats.size;
        
        if (file.includes('critical') || file.includes('app-shell')) {
          criticalSize += stats.size;
          console.log(`  ⚡ ${file}: ${sizeKB}KB (critical)`);
        }
        
        chunkSizes.push({ name: file, size: stats.size, sizeKB });
      }
    });
    
    // Sort chunks by size
    chunkSizes.sort((a, b) => b.size - a.size);
    
    console.log('\n📈 Top 10 Largest Chunks:');
    chunkSizes.slice(0, 10).forEach((chunk, i) => {
      const type = chunk.name.includes('vendor') ? '📦' : 
                   chunk.name.includes('route') ? '🛣️' :
                   chunk.name.includes('feature') ? '⚙️' : '📄';
      console.log(`  ${i + 1}. ${type} ${chunk.name}: ${chunk.sizeKB}KB`);
    });
    
    console.log('\n📊 Size Summary:');
    console.log(`  Total JS: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`  Critical Path: ${(criticalSize / 1024).toFixed(2)}KB`);
    console.log(`  Average Chunk: ${(totalSize / chunkSizes.length / 1024).toFixed(2)}KB`);
    
    // Check against targets
    console.log('\n🎯 Performance Targets:');
    const targets = {
      'Main Bundle': { current: criticalSize / 1024, target: 500, unit: 'KB' },
      'Total JS': { current: totalSize / 1024, target: 2000, unit: 'KB' },
      'Chunk Warning': { current: Math.max(...chunkSizes.map(c => c.size)) / 1024, target: 200, unit: 'KB' }
    };
    
    for (const [name, data] of Object.entries(targets)) {
      const status = data.current <= data.target ? '✅' : '⚠️';
      const percent = ((data.current / data.target) * 100).toFixed(1);
      console.log(`  ${status} ${name}: ${data.current.toFixed(2)}${data.unit} / ${data.target}${data.unit} (${percent}%)`);
    }
    
    // Check for HTML file
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const htmlSize = fs.statSync(indexPath).size;
      console.log(`\n📄 HTML Entry: ${(htmlSize / 1024).toFixed(2)}KB`);
    }
    
    // Check for CSS files
    const cssFiles = files.filter(f => f.endsWith('.css'));
    if (cssFiles.length > 0) {
      let cssTotal = 0;
      cssFiles.forEach(file => {
        const filePath = path.join(assetsPath, file);
        cssTotal += fs.statSync(filePath).size;
      });
      console.log(`🎨 Total CSS: ${(cssTotal / 1024).toFixed(2)}KB (${cssFiles.length} files)`);
    }
  }
} else {
  console.log('⚠️  No build found in dist/');
  console.log('💡 Run "npm run build" first (ignore TypeScript errors for now)');
  console.log('\nAlternatively, try:');
  console.log('  NODE_ENV=production npx vite build --mode production');
}

console.log('\n' + '=' .repeat(60));
console.log('✅ Bundle analysis complete');

// Recommendations based on Phase 5.3
console.log('\n💡 Phase 5.3 Optimizations:');
console.log('  1. Image optimization pipeline needed (highest impact)');
console.log('  2. Singapore edge region configured ✅');
console.log('  3. Consider lazy loading large vendor chunks');
console.log('  4. Implement WebP conversion for images');
console.log('  5. Add INP tracking to Core Web Vitals');