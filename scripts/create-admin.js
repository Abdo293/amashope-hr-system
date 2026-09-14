import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://api.amashope.com';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2];
const password = process.argv[3];
const fullName = process.argv[4] || 'HR System Administrator';

if (!serviceRoleKey || !email || !password || password.length < 12) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY, email, and a password of at least 12 characters are required.');
  console.log('Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/create-admin.js <email> <strong-password> [full-name]\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createFirstAdmin() {
  console.log(`\n⏳ Creating First Admin User: ${email}...`);

  // 1. Check if user already exists in auth.users
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let userId;

  if (existingUser) {
    console.log(`ℹ️  User "${email}" already exists in Auth (ID: ${existingUser.id}). Linking to hr_users...`);
    userId = existingUser.id;
  } else {
    // 2. Create Auth User
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !newUser.user) {
      console.error('❌ Failed to create auth user:', authError?.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`✅ Auth user created successfully (ID: ${userId}).`);
  }

  // 3. Upsert into hr_users as Admin
  const { data: hrUser, error: hrError } = await supabase
    .from('hr_users')
    .upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      full_name: fullName,
      role: 'admin',
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (hrError) {
    console.error('❌ Failed to create hr_users admin record:', hrError.message);
    process.exit(1);
  }

  console.log('\n🎉 First Admin Account Created Successfully!');
  console.log('-------------------------------------------');
  console.log(`Email:    ${email}`);
  console.log(`Role:     ${hrUser.role}`);
  console.log(`Status:   ${hrUser.is_active ? 'Active' : 'Disabled'}`);
  console.log('-------------------------------------------\n');
}

createFirstAdmin().catch((error) => {
  console.error('❌ Failed to create the first admin:', error instanceof Error ? error.message : error);
  process.exit(1);
});
