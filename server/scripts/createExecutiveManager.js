// scripts/createExecutiveManager.js
// Script to create an Executive Manager account

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Admin = require('../models/Admin');

const createExecutiveManager = async () => {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Check if executive manager already exists
    const existing = await Admin.findOne({ email: 'manager@gt3.com' });

    if (existing) {
      console.log('⚠️ Executive Manager already exists:');
      console.log('   Email:', existing.email);
      console.log('   Role:', existing.role);
      console.log('   Permissions:', existing.permissions);
      console.log('\n💡 To reset password, delete this admin first or use a different email.\n');
      process.exit(0);
    }

    // Create new executive manager
    console.log('🔨 Creating Executive Manager account...\n');

    const manager = new Admin({
      name: 'Executive Manager',
      email: 'manager@gt3.com',
      password: 'Manager@123!',  // CHANGE THIS PASSWORD AFTER FIRST LOGIN!
      role: 'executive-manager'
    });

    await manager.save();

    console.log('✅ Executive Manager created successfully!\n');
    console.log('📋 Account Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Email:       manager@gt3.com');
    console.log('   Password:    Manager@123!');
    console.log('   Role:        executive-manager');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔑 Permissions Granted:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    manager.permissions.forEach(perm => {
      console.log('   ✓', perm);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🚫 Permissions Denied:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✗ financial:view (No access to financial data)');
    console.log('   ✗ financial:export (Cannot export reports)');
    console.log('   ✗ fare:view (Cannot view fare settings)');
    console.log('   ✗ fare:edit (Cannot edit fare settings)');
    console.log('   ✗ settings:view (No settings access)');
    console.log('   ✗ settings:edit (Cannot modify settings)');
    console.log('   ✗ admins:manage (Cannot manage other admins)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   1. CHANGE THE DEFAULT PASSWORD immediately after first login!');
    console.log('   2. This account has LIMITED access (no financial/fare/settings)');
    console.log('   3. Can manage: Drivers, Rides, Manual Bookings, Queue');
    console.log('   4. Cannot access: Financial data, Fare settings, Admin management');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎯 Next Steps:');
    console.log('   1. Login at: /admin/login');
    console.log('   2. Use credentials above');
    console.log('   3. Change password immediately');
    console.log('   4. Test access to allowed sections\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Executive Manager:', error);
    process.exit(1);
  }
};

// Run the script
createExecutiveManager();
