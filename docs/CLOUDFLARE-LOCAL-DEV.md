# Cloudflare Functions Local Development Guide

## 🚀 Quick Start

Your Cloudflare Pages Functions local development environment uses a dual-server setup:

```bash
# 1. First, update your secrets in .dev.vars
#    Replace placeholder values with your actual keys

# 2. Ensure your frontend environment variables are in .env.local
#    VITE_SUPABASE_URL=https://your-project.supabase.co
#    VITE_SUPABASE_ANON_KEY=your-anon-key
#    VITE_TURNSTILE_SITE_KEY=your-site-key

# 3. Run both development servers
npm run dev:cf

# This starts:
#   - Vite dev server on http://localhost:5173 (frontend with HMR)
#   - Wrangler dev server on http://localhost:8788 (Cloudflare Functions)
#   - API calls to localhost:5173/api/* are proxied to localhost:8788

# 4. Visit http://localhost:5173
#    - Frontend: http://localhost:5173
#    - API endpoints: http://localhost:5173/api/* (proxied to Wrangler)
```

## 📁 Project Structure

```
okaeri-resort/
├── functions/              # Cloudflare Functions
│   ├── _middleware.ts      # Global middleware (auth, CORS, rate limiting)
│   ├── api/                # API endpoints
│   │   ├── health.ts       # Health check endpoint
│   │   ├── bookings/       # Booking endpoints
│   │   └── ...
│   └── lib/                # Shared utilities
├── src/                    # React frontend
│   └── lib/
│       └── api-client.ts   # API client utilities
├── .dev.vars              # Local development secrets (gitignored)
├── .env.local             # Frontend environment variables (gitignored)
├── wrangler.toml          # Cloudflare configuration
└── vite.config.ts         # Vite + Cloudflare plugin configuration
```

## 🛠 Configuration Files

### `.dev.vars` (Secrets for Cloudflare Functions)

This file contains backend secrets that are only accessible to your Cloudflare Functions:

```bash
# Backend secrets - never exposed to frontend
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
TURNSTILE_SECRET_KEY=your-turnstile-secret
ENVIRONMENT=development
```

### `.env.local` (Frontend Environment Variables)

This file contains public environment variables accessible to your React app:

```bash
# Frontend variables - safe to expose
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TURNSTILE_SITE_KEY=your-site-key
```

### `wrangler.toml` (Cloudflare Configuration)

The main configuration file for Cloudflare Workers/Pages:

- Development environment settings
- KV namespace bindings
- Environment-specific configurations

## 🔧 How It Works

### 1. **Dual Server Architecture**

We use two separate development servers that work together:

- **Vite Dev Server (port 5173)**: Serves the React frontend with hot module replacement
- **Wrangler Dev Server (port 8788)**: Runs Cloudflare Pages Functions locally
- **Proxy Configuration**: Vite proxies `/api/*` requests to Wrangler

This approach is necessary because:

- The official `@cloudflare/vite-plugin` is designed for Workers (single file), not Pages Functions (directory-based)
- Pages Functions use file-based routing in the `/functions` directory
- We need both Vite's HMR for frontend development and Wrangler for function execution

### 2. **Request Flow**

```
Browser Request → Vite Dev Server (5173)
                        ↓
             Is it an /api/* route?
                   ↙        ↘
                 NO          YES
                 ↓            ↓
           React App    Proxy to Wrangler (8788)
                              ↓
                        Cloudflare Function
                         in /functions/api/
```

### 3. **Middleware Processing**

All API requests go through `functions/_middleware.ts`:

1. **CORS Headers**: Applied for cross-origin requests
2. **Security Headers**: CSP, HSTS, etc.
3. **Authentication**: JWT verification for protected routes
4. **Rate Limiting**: Using KV namespace
5. **Request ID**: Tracking for debugging

## 📝 Available Scripts

```bash
# Primary development command (recommended)
npm run dev:cf          # Runs both Vite and Wrangler concurrently

# Individual servers (for debugging)
npm run dev:vite        # Vite dev server only (frontend)
npm run dev:wrangler    # Wrangler dev server only (functions)
npm run dev             # Vite only (alias for standard dev)

# Build and deploy
npm run build           # Build for production
npm run deploy          # Deploy to Cloudflare Pages
npm run deploy:preview  # Deploy to preview branch

# Utilities
npm run clean           # Clean build artifacts
node scripts/verify-cf-setup.js  # Verify setup configuration
bash scripts/test-cf-local.sh    # Test if servers are running
```

## 🔍 Testing the Setup

### 1. **Verify Configuration**

```bash
node scripts/verify-cf-setup.js
```

This script checks:

- Required files exist
- Dependencies installed
- Configuration proper
- Environment variables set

### 2. **Test Health Endpoint**

```bash
# After starting dev server
curl http://localhost:5173/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T..."
}
```

### 3. **Test in Browser**

```javascript
// In browser console
fetch("/api/health")
  .then((res) => res.json())
  .then(console.log);
```

## 🐛 Troubleshooting

### Issue: "Port 8788 already in use"

**Solution**: Kill the existing process or use a different port

```bash
# Find and kill the process
lsof -i :8788
kill -9 <PID>

# Or change the port in package.json
"dev:wrangler": "wrangler pages dev public --port 8789 --local"
# Also update vite.config.ts proxy target
```

### Issue: "KV namespace not found"

**Solution**: The local KV namespace is created automatically. If issues persist:

```bash
# Create KV namespace manually
npx wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

### Issue: "Environment variables not loading"

**Check**:

1. `.dev.vars` exists and has correct values
2. `.env.local` exists for frontend variables
3. Restart the dev server after changing variables

### Issue: "API calls return 404"

**Check**:

1. Both servers are running (`npm run dev:cf`)
2. Function file exists in `functions/api/`
3. Function exports correct handler (onRequestGet, onRequestPost, etc.)
4. Path matches file structure
5. Proxy is configured in vite.config.ts:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:8788',
       changeOrigin: true,
     }
   }
   ```

### Issue: "Wrangler not starting or functions not loading"

**Check**:

1. Functions directory exists at project root
2. Files follow the structure: `functions/api/[endpoint].ts`
3. Each function exports named handlers: `export const onRequestGet`
4. Run `wrangler pages dev public --port 8788 --local` manually to see errors

### Issue: "CORS errors"

**Check**:

1. Middleware is properly configured
2. Origin is allowed in `functions/_middleware.ts`
3. Request includes proper headers

## 🚢 Production Deployment

When ready to deploy:

1. **Set Production Secrets**:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put SUPABASE_JWT_SECRET
```

2. **Build and Deploy**:

```bash
npm run build
npm run deploy
```

3. **Verify Deployment**:

```bash
curl https://your-app.pages.dev/api/health
```

## 📚 Additional Resources

- [Cloudflare Vite Plugin Docs](https://developers.cloudflare.com/workers/vite-plugin/)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Pages Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [KV Namespace Docs](https://developers.cloudflare.com/kv/)

## 💡 Tips and Best Practices

1. **Environment Variables**:
   - Keep backend secrets in `.dev.vars`
   - Keep frontend variables in `.env.local`
   - Never commit either file to git

2. **Function Development**:
   - Export named handlers (onRequestGet, onRequestPost, etc.)
   - Use TypeScript for better type safety
   - Leverage middleware for common functionality

3. **Performance**:
   - Functions have 50ms CPU time limit (free tier)
   - Use KV for caching when appropriate
   - Minimize bundle size for faster cold starts

4. **Debugging**:
   - Check browser DevTools Network tab
   - Look for Cloudflare logs in terminal
   - Use `wrangler tail` for production logs

5. **Testing**:
   - Test functions individually with curl
   - Use the verification script regularly
   - Test both development and production builds

## 🎉 You're All Set!

Your Cloudflare Functions now work seamlessly with your local development environment. Happy coding!
