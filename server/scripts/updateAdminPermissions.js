// scripts/updateAdminPermissions.js
// Script to update existing admin accounts with new permissions

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Admin = require('../models/Admin');

const updateAdminPermissions = async () => {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Find all admin accounts (not executive-manager, not super-admin)
    const admins = await Admin.find({ role: 'admin' });

    if (admins.length === 0) {
      console.log('⚠️ No regular admin accounts found.');
      process.exit(0);
    }

    console.log(`🔍 Found ${admins.length} admin account(s) to update:\n`);

    // Full permissions for regular admin (same as super-admin)
    const fullPermissions = [
      'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
      'rides:view', 'rides:manage', 'rides:manual_booking',
      'users:view', 'users:create', 'users:edit',
      'queue:view', 'queue:manage',
      'financial:view', 'financial:export',
      'fare:view', 'fare:edit',
      'settings:view', 'settings:edit',
      'admins:manage'
    ];

    // Update each admin
    for (const admin of admins) {
      console.log(`📝 Updating: ${admin.email} (${admin.name})`);
      console.log(`   Old permissions count: ${admin.permissions.length}`);

      admin.permissions = fullPermissions;
      await admin.save();

      console.log(`   ✅ New permissions count: ${admin.permissions.length}`);
      console.log(`   Permissions: ${admin.permissions.join(', ')}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All admin accounts updated successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Summary:');
    console.log(`   Updated ${admins.length} admin account(s)`);
    console.log(`   Each now has ${fullPermissions.length} permissions`);
    console.log(`   Regular admins now have full access (same as super-admin)\n`);

    console.log('💡 Note: Executive-manager accounts are not affected by this update.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin permissions:', error);
    process.exit(1);
  }
};

// Run the script
updateAdminPermissions();
