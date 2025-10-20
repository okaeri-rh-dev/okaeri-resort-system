# 🔧 Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when developing, deploying, and maintaining the Okaeri Resort System. Each solution includes diagnostic steps, root cause analysis, and preventive measures.

## 📋 Quick Diagnostics

Before troubleshooting specific issues, run these diagnostic commands:

```bash
# Check Node and npm versions
node --version  # Should be >= v20.0.0
npm --version   # Should be >= v10.0.0

# Verify dependencies
npm list --depth=0

# Check TypeScript compilation
npm run type-check

# Test database connection
npx supabase status

# Check environment variables
node -e "console.log(Object.keys(process.env).filter(k => k.startsWith('VITE_')).sort())"
```

## 🚨 Common Issues

### Development Issues

#### Issue: Development server won't start

**Error Message**:

```
Error: Cannot find module 'vite'
```

**Solution**:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# If that doesn't work, clear npm cache
npm cache clean --force
npm install
```

**Prevention**:

- Always use `npm ci` instead of `npm install` for consistent installs
- Commit `package-lock.json` to version control

---

#### Issue: TypeScript errors blocking build

**Error Message**:

```
Type error: Property 'X' does not exist on type 'Y'
```

**Diagnosis**:

```bash
# Check for type errors
npm run type-check

# Generate fresh types from Supabase
npx supabase gen types typescript --local > database.types.ts
```

**Solution**:

```typescript
// Add type assertions for dynamic properties
const booking = data as Booking;

// Or update type definitions
interface Booking {
  // Add missing property
  newProperty?: string;
}
```

**Prevention**:

- Keep `database.types.ts` synchronized with database schema
- Use strict TypeScript settings in development

---

#### Issue: Hot Module Replacement (HMR) not working

**Symptoms**: Changes don't reflect in browser without manual refresh

**Solution**:

```bash
# Check Vite config
# vite.config.ts
export default defineConfig({
  server: {
    hmr: {
      overlay: true,
      port: 5173
    },
    watch: {
      usePolling: true // For Docker/WSL environments
    }
  }
})
```

**Alternative Solutions**:

1. Clear browser cache
2. Disable browser extensions
3. Check firewall settings for WebSocket connections

### Database Issues

#### Issue: Supabase connection timeout

**Error Message**:

```
FetchError: request to https://xxxxx.supabase.co failed, reason: connect ETIMEDOUT
```

**Diagnosis**:

```bash
# Test connection
curl https://your-project.supabase.co/rest/v1/

# Check DNS resolution
nslookup your-project.supabase.co
```

**Solutions**:

1. **Check environment variables**:

```bash
# Verify .env.local
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

2. **Verify Supabase project status**:

- Log into Supabase Dashboard
- Check if project is paused (free tier auto-pauses after 7 days)
- Unpause if necessary

3. **Check network/firewall**:

```bash
# Test connectivity
ping supabase.co
traceroute your-project.supabase.co
```

**Prevention**:

- Set up connection pooling
- Implement retry logic
- Monitor database uptime

---

#### Issue: RLS (Row Level Security) blocking queries

**Error Message**:

```
Error: new row violates row-level security policy for table "bookings"
```

**Diagnosis**:

```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- View policies
SELECT * FROM pg_policies
WHERE tablename = 'bookings';
```

**Solution**:

```sql
-- Temporarily disable RLS for debugging (DEVELOPMENT ONLY)
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Fix policy
CREATE POLICY "Users can view own bookings" ON bookings
FOR SELECT
USING (project_id IN (
  SELECT project_id FROM project_members
  WHERE user_id = auth.uid()
));

-- Re-enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
```

**Prevention**:

- Test RLS policies thoroughly
- Use service role key for admin operations
- Document policy requirements

---

#### Issue: Database migrations failing

**Error Message**:

```
Error: column "new_column" already exists
```

**Solution**:

```sql
-- Check if migration was partially applied
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'your_table';

-- Use idempotent migrations
ALTER TABLE your_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);
```

**Prevention**:

- Always use `IF NOT EXISTS` clauses
- Test migrations on staging first
- Keep migration files versioned

### Authentication Issues

#### Issue: User authentication failing

**Error Message**:

```
Error: Invalid login credentials
```

**Diagnosis**:

```typescript
// Check auth configuration
const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Debug auth state
const {
  data: { session },
} = await supabase.auth.getSession();
console.log("Current session:", session);
```

**Solutions**:

1. **Clear auth cookies**:

```javascript
await supabase.auth.signOut();
localStorage.clear();
sessionStorage.clear();
```

2. **Check email confirmation**:

```sql
-- In Supabase SQL editor
SELECT email, confirmed_at
FROM auth.users
WHERE email = 'user@example.com';
```

3. **Reset password flow**:

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
});
```

### Build & Deployment Issues

#### Issue: Build failing on Vercel

**Error Message**:

```
Error: Cannot find module '@/components/SomeComponent'
```

**Diagnosis**:

```bash
# Check tsconfig paths
cat tsconfig.json | grep -A 5 "paths"

# Verify import paths
grep -r "from '@/" src/
```

**Solution**:

```json
// vite.config.ts
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

**Prevention**:

- Test production build locally before deploying
- Use consistent import paths
- Configure build caching properly

---

#### Issue: Environment variables not working in production

**Symptoms**: Features working locally but not in production

**Diagnosis**:

```javascript
// Add debug logging (remove in production)
console.log("Env vars:", {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  appEnv: import.meta.env.VITE_APP_ENV,
});
```

**Solution**:

1. **Verify Vercel environment variables**:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Ensure all `VITE_` prefixed variables are set
   - Redeploy after changes

2. **Check variable naming**:
   - Client-side variables MUST start with `VITE_`
   - Server-side variables should NOT have `VITE_` prefix

**Prevention**:

- Use environment variable validation script
- Document all required variables
- Test with production environment locally

### Performance Issues

#### Issue: Slow page load times

**Diagnosis**:

```bash
# Analyze bundle size
npm run build
# Check dist folder size

# Use bundle analyzer
npm install -D rollup-plugin-visualizer
```

**Solutions**:

1. **Code splitting**:

```typescript
// Lazy load heavy components
const BookingForm = lazy(() => import('./components/BookingForm'))

// Use Suspense
<Suspense fallback={<Loading />}>
  <BookingForm />
</Suspense>
```

2. **Optimize images**:

```typescript
// Use optimized formats
import { optimizeImage } from '@/utils/image'

const ImageComponent = ({ src }) => (
  <img
    src={optimizeImage(src)}
    loading="lazy"
    decoding="async"
  />
)
```

3. **Remove unused dependencies**:

```bash
# Find unused dependencies
npx depcheck

# Remove them
npm uninstall unused-package
```

---

#### Issue: Memory leaks in development

**Symptoms**: Browser becomes sluggish over time

**Diagnosis**:

```javascript
// Check for memory leaks
if (process.env.NODE_ENV === "development") {
  window.performance.memory;
}
```

**Solutions**:

1. **Clean up subscriptions**:

```typescript
useEffect(() => {
  const subscription = supabase.from("bookings").on("*", callback).subscribe();

  // Cleanup
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

2. **Clear timers**:

```typescript
useEffect(() => {
  const timer = setInterval(fetchData, 5000);

  return () => clearInterval(timer);
}, []);
```

### UI/UX Issues

#### Issue: Components not rendering correctly

**Diagnosis**:

```bash
# Check for CSS conflicts
npm ls tailwindcss
npm ls @tailwindcss/postcss
```

**Solutions**:

1. **Check Tailwind configuration**:

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  // Ensure no conflicting plugins
};
```

2. **Clear CSS cache**:

```bash
# Delete generated CSS
rm -rf src/styles/generated
npm run dev
```

---

#### Issue: Form validation not working

**Error Message**:

```
TypeError: Cannot read property 'validate' of undefined
```

**Solution**:

```typescript
// Ensure react-hook-form setup
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});

// Check Zod schema
const schema = z.object({
  email: z.string().email(),
  // other fields
});
```

### Mobile/PWA Issues

#### Issue: PWA not installing

**Diagnosis**:

```javascript
// Check PWA requirements
window.addEventListener("beforeinstallprompt", (e) => {
  console.log("PWA install available");
});
```

**Solutions**:

1. **Verify manifest.json**:

```json
{
  "name": "Okaeri Resort System",
  "short_name": "Okaeri",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

2. **Check HTTPS**:
   - PWA requires HTTPS (except localhost)
   - Verify SSL certificate

3. **Service Worker registration**:

```javascript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

## 🛠️ Debugging Tools

### Browser DevTools

```javascript
// Debug React Query
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Debug Zustand stores
window.__ZUSTAND_DEVTOOLS__ = true;

// Debug network requests
window.addEventListener("fetch", (e) => {
  console.log("Fetch:", e.request.url);
});
```

### Logging Strategy

```typescript
// Structured logging
const logger = {
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data);
    // Send to error tracking service
  },
  warn: (message: string, data?: any) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, data);
    }
  },
  info: (message: string, data?: any) => {
    if (process.env.VITE_DEBUG) {
      console.log(`[INFO] ${message}`, data);
    }
  },
};
```

## 🔍 Health Checks

### API Health Check

```bash
# Check API status
curl http://localhost:3000/api/health

# Expected response
{
  "status": "healthy",
  "database": "connected",
  "version": "0.0.1"
}
```

### Database Health Check

```sql
-- Check database performance
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

## 📊 Performance Monitoring

### Key Metrics

```javascript
// Monitor Core Web Vitals
import { getCLS, getFCP, getFID, getLCP, getTTFB } from "web-vitals";

getCLS(console.log); // Cumulative Layout Shift
getFID(console.log); // First Input Delay
getFCP(console.log); // First Contentful Paint
getLCP(console.log); // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

### Performance Budget

```javascript
// vite.config.ts
export default {
  build: {
    chunkSizeWarningLimit: 500, // KB
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/*"],
          utils: ["date-fns", "zod"],
        },
      },
    },
  },
};
```

## 🆘 Getting Help

### Before Asking for Help

1. **Check existing documentation**
2. **Search GitHub issues**
3. **Review error messages carefully**
4. **Isolate the problem** (create minimal reproduction)
5. **Gather diagnostic information**

### Information to Provide

```markdown
## Issue Description

[Clear description of the problem]

## Steps to Reproduce

1. [First step]
2. [Second step]
3. [...]

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

- OS: [e.g., macOS 13.0]
- Node: [e.g., 20.0.0]
- Browser: [e.g., Chrome 118]
- Package versions: [from package.json]

## Error Messages
```

[Full error message/stack trace]

```

## Screenshots
[If applicable]

## Attempted Solutions
[What you've already tried]
```

## 📚 Additional Resources

- [Vercel Troubleshooting](https://vercel.com/docs/troubleshooting)
- [Supabase Troubleshooting](https://supabase.com/docs/guides/troubleshooting)
- [Vite Troubleshooting](https://vitejs.dev/guide/troubleshooting.html)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TypeScript Error Reference](https://typescript.tv/errors/)
