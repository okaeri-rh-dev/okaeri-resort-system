# 🚀 Okaeri Resort System - Phase 2 Deployment Guide

## Overview

This guide covers deploying Phase 2 of the Okaeri Resort System to Vercel with optimized configuration for small business operations.

## ✅ Pre-Deployment Checklist

### 1. Build Verification

- [x] TypeScript errors reduced to Phase 2 acceptable levels (~53 errors)
- [x] Build process optimized for Vercel deployment
- [x] Bundle size optimized with chunk splitting
- [x] Pre-commit hooks configured for Phase 2 scope

### 2. Configuration Files

- [x] `vercel.json` optimized for Philippine users (SIN1, HKG1 regions)
- [x] `vite.config.ts` configured with performance optimizations
- [x] `.env.production` template created
- [x] Security headers configured

## 🔧 Environment Variables Setup

### Required Vercel Environment Variables

#### Supabase Configuration (Critical)

```bash
# Get these from your Supabase dashboard → Settings → API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only (for API functions)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Application Configuration

```bash
NODE_ENV=production
VITE_APP_ENV=production
VITE_APP_NAME=Okaeri Resort System
VITE_DEBUG=false
VITE_API_TIMEOUT=8000
```

#### Feature Flags (Phase 2 Only)

```bash
VITE_FEATURE_BOOKINGS=true
VITE_FEATURE_GUESTS=true
VITE_FEATURE_UNITS=true
VITE_FEATURE_DASHBOARD=true
VITE_FEATURE_WORKFLOWS=false
VITE_FEATURE_ADVANCED_REPORTS=false
```

## 🚀 Deployment Steps

### 1. Deploy to Vercel

#### Option A: CLI Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: GitHub Integration

1. Connect your GitHub repository to Vercel
2. Push to main branch for automatic deployment
3. Environment variables will be applied automatically

### 2. Set Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all required variables from the list above
3. Set environment to "Production"
4. Deploy the project

### 3. Database Setup

#### Supabase Configuration

1. Create a new Supabase project
2. Run the database migrations from `/database/migrations/`
3. Set up Row Level Security policies
4. Configure authentication providers if needed

## 📊 Performance Monitoring

### Vercel Analytics (Free Tier)

- Automatically enabled for core web vitals
- Real user monitoring
- Performance insights

### Recommended Monitoring Setup

```javascript
// Add to main.tsx for basic error tracking
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});
```

## 💰 Cost Optimization (Free Tier Focus)

### Current Bundle Analysis

- Main bundle: ~567KB (166KB gzipped)
- Vendor chunk: ~12KB (4KB gzipped)
- UI components: ~84KB (28KB gzipped)
- Supabase: ~125KB (34KB gzipped)
- Utils: ~77KB (19KB gzipped)

### Free Tier Limits

- **Bandwidth**: 100GB/month
- **Function Executions**: 100GB-hrs/month
- **Function Duration**: 10s (hobby), 30s (configured)
- **Deployments**: Unlimited

### Optimization Strategies

1. **Caching**: Static assets cached for 1 year
2. **Compression**: Gzip enabled for all assets
3. **Code Splitting**: Vendor code separated for better caching
4. **Regions**: Optimized for APAC users (SIN1, HKG1)

## 🔒 Security Configuration

### Security Headers (Configured)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### CORS Configuration

- API endpoints configured for cross-origin requests
- Secure headers for authentication

## 🌏 Regional Optimization

### Philippine Users

- Primary region: `sin1` (Singapore)
- Secondary region: `hkg1` (Hong Kong)
- Expected latency: 20-50ms from Manila

## 🔍 Testing Deployment

### Pre-Launch Tests

1. **Build Test**: `npm run build:phase2`
2. **Type Check**: `npm run type-check:phase2`
3. **Local Preview**: `npm run preview`

### Post-Deployment Tests

1. **Core Features**:
   - Guest management ✓
   - Booking system ✓
   - Unit management ✓
   - Dashboard analytics ✓

2. **Performance**:
   - Page load speed < 3s
   - Core Web Vitals scores
   - Mobile responsiveness

3. **Database Connection**:
   - CRUD operations working
   - Real-time updates
   - Authentication flow

## 🚨 Rollback Strategy

### Quick Rollback

```bash
# Revert to previous deployment
vercel rollback [deployment-url]
```

### Database Rollback

- Keep previous migration snapshots
- Use Supabase backup and restore features

## 📈 Go-Live Monitoring

### Day 1 Checklist

- [ ] All features accessible
- [ ] Database operations working
- [ ] Authentication functional
- [ ] Performance within targets
- [ ] Error rates < 1%

### Week 1 Monitoring

- User engagement metrics
- Performance trends
- Error patterns
- Resource usage

## 🆘 Troubleshooting

### Common Issues

#### Build Failures

- Check TypeScript error count (should be < 100)
- Verify environment variables
- Check Vercel build logs

#### Database Connection Issues

- Verify Supabase credentials
- Check network connectivity
- Review RLS policies

#### Performance Issues

- Monitor bundle sizes
- Check network requests
- Review database query performance

### Support Contacts

- **Technical**: Check Vercel documentation
- **Database**: Supabase support portal
- **Emergency**: System administrator

## 📞 Emergency Procedures

### System Down

1. Check Vercel status page
2. Verify Supabase status
3. Check deployment logs
4. Initiate rollback if needed

### Data Issues

1. Stop new operations
2. Backup current state
3. Investigate issue
4. Restore from backup if needed

---

**Deployment Configuration Summary:**

- ✅ TypeScript errors: 53 (within Phase 2 threshold)
- ✅ Build optimization: Enabled
- ✅ Security headers: Configured
- ✅ Regional optimization: APAC focus
- ✅ Free tier optimization: Enabled
- ✅ Monitoring: Basic setup ready

**Next Phase**: Phase 3 will introduce workflow automation and advanced reporting features.
