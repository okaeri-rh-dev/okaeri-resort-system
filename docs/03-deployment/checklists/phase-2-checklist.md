# PHASE 2 DEPLOYMENT SECURITY CHECKLIST

## 🚨 CRITICAL - MUST COMPLETE BEFORE GO-LIVE

### 1. Enable Row Level Security (RLS)

**Status**: ⚠️ REQUIRES MANUAL ACTION

```bash
# Steps:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open file: /database/enable-rls.sql
4. Copy entire contents
5. Paste in SQL Editor
6. Click "Run"
7. Verify with: /database/verify-rls-status.sql
```

**Verification**: All tables should show "✅ ENABLED" in verification script

### 2. Create Admin User

**Status**: ⚠️ REQUIRES SETUP

```bash
# In Supabase Dashboard:
1. Go to Authentication > Users
2. Click "Invite User"
3. Enter admin email
4. Set secure password
5. Test login in application
```

### 3. Configure Storage Buckets

**Status**: ✅ Script Provided (included in enable-rls.sql)

Buckets configured:

- `payment-proofs` - For payment proof uploads
- `receipts` - For expense receipts

---

## ✅ ALREADY IMPLEMENTED - VERIFY WORKING

### Security Features Status

| Feature               | Status         | Test Method                           |
| --------------------- | -------------- | ------------------------------------- |
| CSV Export Protection | ✅ IMPLEMENTED | Export data with "=1+1" as guest name |
| Search Sanitization   | ✅ IMPLEMENTED | Search with special characters        |
| Privacy Consent       | ✅ IMPLEMENTED | Try booking without consent checkbox  |
| File Upload Limits    | ✅ IMPLEMENTED | Try uploading >5MB file               |
| Session Management    | ✅ IMPLEMENTED | Stay logged in for >50 minutes        |
| Secure Logout         | ✅ IMPLEMENTED | Check browser storage after logout    |

---

## 📋 PRE-DEPLOYMENT TESTING

Run these tests before going live:

### 1. Authentication Test

```bash
✓ Can log in with valid credentials
✓ Cannot log in with invalid credentials
✓ Session persists after browser refresh
✓ Logout clears all session data
```

### 2. RLS Test

```bash
✓ Cannot access /api/* without authentication
✓ Cannot query database tables without auth
✓ Authenticated users can access their data
```

### 3. File Upload Test

```bash
✓ Can upload PNG/JPG under 5MB
✓ Cannot upload files over 5MB
✓ Cannot upload non-image files
✓ Files stored with secure paths
```

### 4. Input Validation Test

```bash
✓ Search strips special characters
✓ CSV export escapes formulas
✓ Form inputs properly validated
```

### 5. Privacy Compliance Test

```bash
✓ Consent checkbox is mandatory
✓ Privacy notice references Philippine DPA
✓ Guest data properly protected
```

---

## 🚀 DEPLOYMENT STEPS

### Phase 2 Go-Live Sequence

1. **Pre-Deployment** (1 hour before)
   - [ ] Run RLS enable script
   - [ ] Verify RLS status
   - [ ] Create admin user
   - [ ] Run security tests

2. **Deployment** (during)
   - [ ] Deploy application code
   - [ ] Verify environment variables
   - [ ] Test authentication flow

3. **Post-Deployment** (immediately after)
   - [ ] Test login as admin
   - [ ] Create test booking
   - [ ] Upload test payment proof
   - [ ] Export test CSV
   - [ ] Verify all features working

4. **Monitoring** (first 24 hours)
   - [ ] Monitor error logs
   - [ ] Check authentication failures
   - [ ] Verify no unauthorized access
   - [ ] Monitor file upload activity

---

## ⚠️ ROLLBACK PLAN

If critical issues occur:

1. **Immediate Response**
   - Note the exact error
   - Check Supabase logs
   - Disable public access if needed

2. **Rollback Steps**

   ```bash
   # If RLS causes issues:
   - Temporarily disable RLS (emergency only)
   - Fix policies
   - Re-enable RLS

   # If auth fails:
   - Check Supabase Auth settings
   - Verify environment variables
   - Reset admin password if needed
   ```

3. **Communication**
   - Inform team of issues
   - Document resolution steps
   - Update this checklist

---

## 📞 SUPPORT CONTACTS

- **Supabase Dashboard**: [Your Project URL]
- **Application URL**: [Your App URL]
- **Documentation**: `/docs` folder

---

## ✅ SIGN-OFF

### Deployment Approval

- [ ] All critical items completed
- [ ] Security tests passed
- [ ] Admin user created and tested
- [ ] RLS verified as enabled
- [ ] Backup plan understood

**Deployed By**: **\*\*\*\***\_**\*\*\*\***
**Date**: **\*\*\*\***\_**\*\*\*\***
**Time**: **\*\*\*\***\_**\*\*\*\***

---

## 📝 POST-DEPLOYMENT NOTES

Add any issues encountered and resolutions here:

```
Date:
Issue:
Resolution:
```

---

_Use this checklist for every Phase 2 deployment. Keep updated with any new security requirements._
