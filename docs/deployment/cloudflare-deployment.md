# Cloudflare Pages Deployment Guide

This guide walks you through deploying the Okaeri Resort System to Cloudflare Pages with unlimited bandwidth on the free tier.

## Why Cloudflare Pages?

- **Unlimited bandwidth** (vs 100GB on Vercel/Netlify)
- **Best performance for Philippines** (extensive Asia-Pacific network)
- **Completely free** for static sites
- **No API functions needed** (app uses Supabase directly)
- **Automatic HTTPS** and custom domains
- **500 builds/month** on free tier

## Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
2. Your Supabase project URL and anon key
3. Git repository (GitHub, GitLab, or direct upload)

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to "Workers & Pages" → "Create application" → "Pages"
   - Click "Connect to Git"
   - Authorize Cloudflare to access your GitHub account
   - Select your `okaeri-resort` repository

2. **Configure Build Settings**

   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   ```

3. **Set Environment Variables**
   Click "Environment variables" and add:

   ```
   VITE_SUPABASE_URL = your_supabase_project_url
   VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```

4. **Deploy**
   - Click "Save and Deploy"
   - Wait 2-3 minutes for the build to complete
   - Your site will be available at `https://[your-project].pages.dev`

### Method 2: Direct Upload (Quick Deploy)

1. **Build Locally**

   ```bash
   # Install dependencies
   npm install

   # Build the project
   npm run build
   ```

2. **Deploy via Wrangler CLI**

   ```bash
   # Deploy to production
   npx wrangler pages deploy dist --project-name okaeri-resort

   # Deploy preview branch
   npx wrangler pages deploy dist --project-name okaeri-resort --branch preview
   ```

3. **First-time Setup**
   - You'll be prompted to login to Cloudflare
   - Select "Allow" in your browser
   - Choose your Cloudflare account
   - The deployment will proceed automatically

### Method 3: Drag & Drop (Simplest)

1. **Build Locally**

   ```bash
   npm run build
   ```

2. **Upload to Cloudflare**
   - Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
   - Click "Create a project" → "Direct Upload"
   - Drag the `dist` folder to the upload area
   - Name your project (e.g., "okaeri-resort")
   - Click "Deploy site"

## Environment Variables Setup

After deployment, configure environment variables:

1. Go to your Pages project settings
2. Click "Settings" → "Environment variables"
3. Add for both "Production" and "Preview":
   ```
   VITE_SUPABASE_URL = your_supabase_project_url
   VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```
4. Trigger a redeploy for changes to take effect

## Custom Domain Setup (Optional)

1. **Add Custom Domain**
   - Go to your Pages project → "Custom domains"
   - Click "Set up a custom domain"
   - Enter your domain (e.g., `resort.example.com`)

2. **DNS Configuration**
   - If using Cloudflare DNS: Automatic setup
   - External DNS: Add CNAME record pointing to `[your-project].pages.dev`

3. **SSL Certificate**
   - Automatically provisioned by Cloudflare
   - Usually active within minutes

## Deployment Scripts

Use these npm scripts for easy deployment:

```bash
# Deploy to production
npm run deploy

# Deploy preview branch
npm run deploy:preview

# Build only (no deploy)
npm run build
```

## Troubleshooting

### Build Fails

1. **TypeScript Errors**
   - The build uses `npm run type-check` first
   - Fix any TypeScript errors before deploying
   - Or temporarily use `vite build` directly in Cloudflare settings

2. **Missing Dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Environment Variables Not Working

1. Ensure variables are set in Cloudflare dashboard
2. Trigger a new deployment after adding variables
3. Check variable names match exactly (case-sensitive)

### 404 Errors on Routes

This is a single-page application. Cloudflare Pages automatically handles this, but if issues occur:

1. Create `_redirects` file in `public/` directory:
   ```
   /*    /index.html   200
   ```

### Performance Optimization

Cloudflare Pages automatically provides:

- Global CDN distribution
- Brotli compression
- HTTP/3 support
- Smart caching
- Image optimization (with Cloudflare Images)

## Monitoring

1. **Analytics**
   - Available in Cloudflare dashboard
   - Shows traffic, bandwidth, and performance metrics

2. **Web Analytics (Optional)**
   - Add Cloudflare Web Analytics for detailed insights
   - Free and privacy-focused

## Rollback Deployments

1. Go to your Pages project → "Deployments"
2. Find a previous successful deployment
3. Click "..." → "Rollback to this deployment"
4. Confirm the rollback

## CI/CD with GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: okaeri-resort
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

## Migration from Vercel

We've already:

1. ✅ Removed `/api` directory (not needed)
2. ✅ Deleted `vercel.json` configuration
3. ✅ Updated `.gitignore` for Cloudflare
4. ✅ Added deployment scripts to `package.json`

The app is now optimized for static hosting with Supabase backend.

## Support

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

## Cost Summary

**Free Tier Includes:**

- Unlimited bandwidth
- 500 builds per month
- Unlimited requests
- Custom domains with SSL
- Global CDN
- DDoS protection

Perfect for small to medium Philippine resort operations! 🏝️
