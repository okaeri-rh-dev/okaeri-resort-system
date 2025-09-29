# Deployment Guide - Cloudflare Pages

This guide covers deploying the Okaeri Resort System to Cloudflare Pages.

## Prerequisites

- Node.js 18+ installed locally
- Cloudflare account (free tier is sufficient)
- Supabase project with database configured

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. **Connect GitHub Repository**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Click "Create a project" → "Connect to Git"
   - Select your GitHub repository

2. **Configure Build Settings**
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 18 or higher

3. **Set Environment Variables**
   Add these in the Cloudflare Pages dashboard:

   ```
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   VITE_APP_ENV=production
   VITE_APP_NAME=Okaeri Resort System
   ```

4. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will automatically build and deploy on every push to main

### Method 2: Wrangler CLI (Manual)

1. **Install Wrangler**

   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**

   ```bash
   wrangler login
   ```

3. **Deploy to Production**

   ```bash
   npm run deploy
   ```

4. **Deploy to Preview**
   ```bash
   npm run deploy:preview
   ```

## Environment Variables

Environment variables must be prefixed with `VITE_` to be accessible in the application.

### Required Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

### Optional Variables

- `VITE_APP_ENV`: Environment (development/staging/production)
- `VITE_APP_NAME`: Application name displayed in UI
- `VITE_DEBUG`: Enable debug logging (development only)
- `VITE_API_TIMEOUT`: API timeout in milliseconds

## Build Configuration

The application is configured for optimal Cloudflare Pages deployment:

- **Build Output**: `dist/` directory
- **Node Version**: 18+
- **Build Command**: `npm run build`
- **Bundle Splitting**: Configured for optimal chunk sizes
- **Source Maps**: Disabled in production for security

## Deployment URLs

After deployment, your application will be available at:

- **Production**: `https://okaeri-resort-system.pages.dev`
- **Preview**: `https://<branch>.<project>.pages.dev`
- **Custom Domain**: Configure in Cloudflare Pages settings

## Monitoring & Analytics

Cloudflare Pages provides:

- Real-time analytics
- Web Analytics (privacy-focused)
- Performance monitoring
- Build logs and deployment history

## Troubleshooting

### Build Failures

1. **Check Node Version**
   Ensure Node.js 18+ is specified in Cloudflare Pages settings

2. **Verify Environment Variables**
   All required `VITE_` prefixed variables must be set

3. **Clear Cache**
   In Cloudflare Pages dashboard: Settings → Clear cache

### Runtime Issues

1. **Check Browser Console**
   Look for missing environment variables or API errors

2. **Verify Supabase Connection**
   Ensure Supabase URL and key are correct

3. **Review Build Logs**
   Check Cloudflare Pages dashboard for detailed build output

## Performance Optimization

The application is optimized for Cloudflare's edge network:

- Automatic HTTP/3 support
- Brotli compression
- Smart caching headers
- Global CDN distribution

## Security Considerations

- Never commit `.env.local` files
- Use Cloudflare's environment variables for secrets
- Enable Web Application Firewall (WAF) rules if needed
- Configure Content Security Policy headers

## Rollback Procedure

To rollback to a previous deployment:

1. Go to Cloudflare Pages dashboard
2. Navigate to Deployments
3. Find the previous successful deployment
4. Click "Rollback to this deployment"

## Support

For deployment issues:

- Check [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- Review build logs in Cloudflare dashboard
- Verify all environment variables are set correctly
