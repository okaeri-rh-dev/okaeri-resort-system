# Environment Setup Guide - Okaeri Resort System

## 🎯 Phase 1 Production Setup

This guide will help you configure the necessary environment variables for
production deployment.

## 📋 Prerequisites

- A Supabase account (free tier available)
- Git repository access
- Node.js 18+ installed

## 🚀 Step-by-Step Setup

### Step 1: Create Supabase Project

1. **Visit Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign up/Sign in to your account

2. **Create New Project**
   - Click "New Project"
   - Organization: Choose or create one
   - Project Name: `okaeri-resort` (or your preferred name)
   - Database Password: Create a strong password (save this!)
   - Region: Choose closest to your location
   - Pricing Plan: Start with "Free" for Phase 1

3. **Wait for Project Initialization**
   - This takes 2-3 minutes
   - You'll see a progress indicator

### Step 2: Get Your Credentials

Once your project is ready:

1. **Navigate to Project Settings**
   - Click the gear icon (⚙️) in the sidebar
   - Go to "API" section

2. **Copy Your Credentials**
   ```
   Project URL: https://your-project-id.supabase.co
   Anon/Public Key: eyJ... (long string starting with eyJ)
   ```

### Step 3: Configure Environment Variables

1. **Update `.env.local`**

   ```bash
   # Replace the placeholder values with your actual credentials
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # App Configuration
   VITE_APP_ENV=development
   VITE_APP_NAME=Okaeri Resort System
   ```

2. **For Production Deployment**
   - **Vercel**: Add these as Environment Variables in your Vercel dashboard
   - **Netlify**: Add these in Site Settings > Environment Variables
   - **Other platforms**: Follow their environment variable configuration guide

### Step 4: Set Up Database Schema

1. **Navigate to SQL Editor**
   - In Supabase dashboard, go to "SQL Editor"
   - Click "New Query"

2. **Run the Database Schema**

   ```sql
   -- Copy the entire contents of database/schema.sql
   -- This creates all tables, indexes, and functions
   ```

3. **Verify Tables Created**
   - Go to "Database" > "Tables"
   - You should see: units, guests, bookings, payments, expenses,
     maintenance_logs

### Step 5: Configure Row Level Security (RLS)

1. **Enable RLS for Production**

   ```sql
   -- Enable RLS on all tables
   ALTER TABLE units ENABLE ROW LEVEL SECURITY;
   ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
   ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
   ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
   ```

2. **Add Basic Policies (Phase 1 - Admin Only)**

   ```sql
   -- Allow full access for authenticated users (Phase 1)
   -- In Phase 2, implement proper role-based policies

   CREATE POLICY "Enable all for authenticated users" ON units
     FOR ALL USING (auth.role() = 'authenticated');

   CREATE POLICY "Enable all for authenticated users" ON guests
     FOR ALL USING (auth.role() = 'authenticated');

   CREATE POLICY "Enable all for authenticated users" ON bookings
     FOR ALL USING (auth.role() = 'authenticated');

   CREATE POLICY "Enable all for authenticated users" ON payments
     FOR ALL USING (auth.role() = 'authenticated');

   CREATE POLICY "Enable all for authenticated users" ON expenses
     FOR ALL USING (auth.role() = 'authenticated');

   CREATE POLICY "Enable all for authenticated users" ON maintenance_logs
     FOR ALL USING (auth.role() = 'authenticated');
   ```

### Step 6: Configure Storage (For Payment Proofs)

1. **Create Storage Bucket**
   - Go to "Storage" in Supabase dashboard
   - Click "New Bucket"
   - Name: `payment-proofs`
   - Make it Public: ❌ (Keep private for security)

2. **Set Storage Policies**

   ```sql
   -- Allow authenticated users to upload payment proofs
   CREATE POLICY "Authenticated users can upload payment proofs"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

   -- Allow authenticated users to view payment proofs
   CREATE POLICY "Authenticated users can view payment proofs"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');
   ```

### Step 7: Create Admin User

1. **Go to Authentication**
   - Navigate to "Authentication" > "Users"
   - Click "Add User"

2. **Create Admin Account**
   - Email: your-admin-email@example.com
   - Password: Create a strong password
   - Confirm Password: Re-enter password
   - ✅ Mark as "Email Confirmed"

## 🔒 Security Configuration

### For Development

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_ENV=development
```

### For Production

```bash
# Environment Variables (in your deployment platform)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_ENV=production
```

## ✅ Verification Checklist

Before going live, verify:

- [ ] Supabase project created and accessible
- [ ] Database schema applied successfully
- [ ] All required tables exist (units, guests, bookings, payments, etc.)
- [ ] Environment variables configured correctly
- [ ] RLS enabled on all tables
- [ ] Storage bucket created for payment proofs
- [ ] Admin user account created
- [ ] Application connects successfully (no console errors)
- [ ] Can create/view/edit/delete records
- [ ] File upload works for payment proofs

## 🚨 Security Reminders

1. **Never commit real credentials to Git**
2. **Use strong passwords for admin accounts**
3. **Enable RLS in production**
4. **Regularly backup your database**
5. **Monitor usage in Supabase dashboard**

## 📞 Support

If you encounter issues:

1. Check Supabase dashboard for error logs
2. Verify environment variables are set correctly
3. Ensure database schema was applied completely
4. Check browser console for JavaScript errors

## 🚀 Next Steps

Once environment setup is complete:

1. Run `npm run dev` to test locally
2. Deploy to your chosen platform
3. Test all CRUD operations in production
4. Set up monitoring and backups

---

**Phase 1 Complete** ✅ Ready for production deployment with basic CRUD
functionality!
