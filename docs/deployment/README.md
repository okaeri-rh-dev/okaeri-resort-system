# Deployment Guide

## Overview

This directory contains deployment guides for the Okaeri Resort System. The application is optimized for serverless deployment with Cloudflare Pages, providing zero-cost infrastructure for small to medium-sized resorts.

## Deployment Options

### Cloudflare Pages (Recommended)

The application is built for Cloudflare Pages deployment with:

- **Zero Infrastructure Costs**: Free tier includes unlimited static requests
- **Cloudflare Functions**: Serverless API endpoints at the edge
- **Cloudflare KV**: Rate limiting and session storage
- **Cloudflare R2**: Cost-effective file storage (when needed)
- **Global CDN**: Fast performance worldwide, optimized for Asia-Pacific

**📖 Guide**: [Cloudflare Deployment](./cloudflare-deployment.md)

## Deployment Architecture

### Frontend (Static Site)
- Built with Vite for optimal bundle size and performance
- Deployed to Cloudflare Pages CDN
- Automatic HTTPS and global edge distribution

### Backend (Serverless Functions)
- Cloudflare Pages Functions for API endpoints
- Supabase for database and authentication
- Edge-optimized for low latency

### Storage
- Supabase Storage for private file uploads
- Signed URLs for secure guest uploads
- Optional Cloudflare R2 for high-volume storage

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Supabase project created and configured
- [ ] Environment variables prepared
- [ ] Database migrations applied
- [ ] Row Level Security (RLS) policies enabled

### 2. Build Verification
- [ ] `npm run build` succeeds without errors
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Bundle size is optimized (check with `npm run build:analyze`)

### 3. Security Review
- [ ] Authentication flows tested
- [ ] RLS policies verified
- [ ] Input validation implemented
- [ ] XSS prevention with DOMPurify
- [ ] Rate limiting configured

### 4. Testing
- [ ] Unit tests passing (`npm run test:run`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Security tests passing (`npm run test:security`)
- [ ] Performance tests acceptable

## Environment Variables

Required environment variables for production:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Application Settings
VITE_APP_ENV=production
VITE_APP_NAME="Okaeri Resort System"
VITE_DEBUG=false

# Cloudflare (for Pages Functions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Post-Deployment

### 1. Smoke Testing
- [ ] Test user authentication
- [ ] Create a test booking
- [ ] Upload a test payment receipt
- [ ] Verify email notifications
- [ ] Test guest booking flow

### 2. Monitoring Setup
- [ ] Configure Cloudflare Analytics
- [ ] Set up Supabase monitoring
- [ ] Enable error tracking (Sentry/LogRocket)
- [ ] Configure uptime monitoring

### 3. Performance Optimization
- [ ] Review Core Web Vitals in Cloudflare Analytics
- [ ] Optimize images if needed
- [ ] Review bundle size and code splitting
- [ ] Enable caching strategies

## Troubleshooting

### Common Issues

**Build Failures**
- Ensure all dependencies are installed
- Check TypeScript errors with `npm run type-check`
- Verify environment variables are set

**Function Errors**
- Check Cloudflare Functions logs
- Verify Supabase service role key is correct
- Ensure database migrations are applied

**Storage Issues**
- Verify Supabase Storage buckets exist
- Check bucket policies and RLS
- Test signed URL generation

## Support

For deployment assistance:
1. Check the specific deployment guide for your platform
2. Review the [troubleshooting guide](../initial/03-deployment/troubleshooting.md)
3. Contact the development team

## Related Documentation

- [Initial Setup & Architecture](../initial/README.md)
- [Implementation Guides](../implementation/)
- [Security Audits](../security/)
- [Phase Releases](../releases/)
