# Deployment & Operations Documentation

## Overview

This section contains all deployment, monitoring, and operational documentation for production environments.

## Contents

### Core Deployment
- [**Production Setup**](./production-setup.md) - Complete production deployment guide
- [**Monitoring Setup**](./monitoring-setup.md) - Application monitoring and alerting
- [**Troubleshooting**](./troubleshooting.md) - Common issues and solutions

### Deployment Checklists
- [**Phase 1 Checklist**](./checklists/phase-1-checklist.md) - Foundation deployment checklist
- [**Phase 2 Checklist**](./checklists/phase-2-checklist.md) - Security and core features checklist
- [**Phase 3 Checklist**](./checklists/phase-3-checklist.md) - Production readiness checklist

## Deployment Platforms

### Vercel (Recommended)
- Frontend hosting
- Serverless API routes
- Edge caching
- Automatic deployments from Git

### Database (Neon PostgreSQL)
- Serverless PostgreSQL
- Automatic backups
- Connection pooling
- Branch databases for development

### File Storage (Cloudflare R2)
- S3-compatible storage
- Cost-effective egress
- Global CDN
- Payment proof storage

## Production Environment Variables

Required environment variables for production:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_APP_ENV=production
```

## Monitoring & Alerts

- Application uptime monitoring
- Error tracking and reporting
- Performance metrics
- Cost monitoring (stay under $3/month)

## Quick Links

- [Architecture →](../01-architecture/README.md)
- [Development Setup →](../02-development/getting-started/environment-setup.md)
- [Release Plans →](../04-releases/README.md)