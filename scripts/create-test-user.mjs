#!/usr/bin/env node
/**
 * Create Test Admin User Script
 *
 * This script creates a test admin user in Supabase for testing purposes.
 * It uses the Supabase Admin API with the service role key.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/create-test-user.mjs
 *
 * Or with all options:
 *   SUPABASE_URL=https://your-project.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
 *   TEST_USER_EMAIL=custom@email.com \
 *   TEST_USER_PASSWORD=CustomPass123! \
 *   node scripts/create-test-user.mjs
 *
 * Environment Variables:
 *   - SUPABASE_URL or VITE_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key (from Supabase dashboard)
 *   - TEST_USER_EMAIL (optional): Custom test user email
 *   - TEST_USER_PASSWORD (optional): Custom test user password
 */

import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) {
    console.error('   - SUPABASE_URL (or VITE_SUPABASE_URL)');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  }
  console.error('\nExample usage:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/create-test-user.mjs');
  process.exit(1);
}

// Test user details (configurable via environment)
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'testadmin@okaeri-resort.test',
  password: process.env.TEST_USER_PASSWORD || 'TestAdmin2024!',
  role: 'admin'
};

async function createTestUser() {
  console.log('🔧 Creating test admin user...\n');

  // Create admin client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Step 1: Check if user already exists
    console.log(`📧 Checking if ${TEST_USER.email} already exists...`);

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = existingUsers.users.find(u => u.email === TEST_USER.email);

    let userId;

    if (existingUser) {
      console.log('✅ User already exists, using existing user');
      userId = existingUser.id;
    } else {
      // Step 2: Create auth user
      console.log('📝 Creating new auth user...');

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        email_confirm: true,  // Auto-confirm the email
        user_metadata: {
          name: 'Test Admin',
          created_for: 'production_testing'
        }
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      userId = newUser.user.id;
      console.log(`✅ Auth user created with ID: ${userId}`);
    }

    // Step 3: Assign admin role
    console.log('🔑 Assigning admin role...');

    // Check if role already exists
    const { data: existingRole, error: roleCheckError } = await supabase
      .from('app_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingRole) {
      console.log('✅ Role already assigned:', existingRole.role);
    } else {
      // Insert new role
      const { data: roleData, error: roleError } = await supabase
        .from('app_roles')
        .upsert({
          user_id: userId,
          email: TEST_USER.email,
          role: TEST_USER.role,
          is_active: true,
          notes: 'Test admin user for production testing',
          granted_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (roleError) {
        throw new Error(`Failed to assign role: ${roleError.message}`);
      }

      console.log('✅ Admin role assigned successfully');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 TEST USER CREATED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`📧 Email:    ${TEST_USER.email}`);
    console.log(`🔑 Password: ${TEST_USER.password}`);
    console.log(`👤 Role:     ${TEST_USER.role}`);
    console.log(`🆔 User ID:  ${userId}`);
    console.log('='.repeat(50));
    console.log('\n⚠️  IMPORTANT: Change the password after testing!');
    console.log('   You can do this via Supabase Dashboard or by logging in.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();
