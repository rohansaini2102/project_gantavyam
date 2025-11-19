// models/Admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['admin', 'super-admin', 'executive-manager'],
    default: 'admin'
  },
  // Permissions array for granular access control
  permissions: [{
    type: String,
    enum: [
      // Driver permissions
      'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
      // Ride permissions
      'rides:view', 'rides:manage', 'rides:manual_booking',
      // User permissions
      'users:view', 'users:create', 'users:edit',
      // Queue permissions
      'queue:view', 'queue:manage',
      // Financial permissions (restricted)
      'financial:view', 'financial:export',
      // Fare permissions
      'fare:view', 'fare:edit',
      // Settings permissions
      'settings:view', 'settings:edit',
      // Admin permissions
      'admins:manage'
    ]
  }],
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-assign permissions based on role (before save)
AdminSchema.pre('save', async function(next) {
  // Assign permissions based on role if role is modified or document is new
  if (this.isModified('role') || this.isNew) {
    switch(this.role) {
      case 'super-admin':
        this.permissions = [
          'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
          'rides:view', 'rides:manage', 'rides:manual_booking',
          'users:view', 'users:create', 'users:edit',
          'queue:view', 'queue:manage',
          'financial:view', 'financial:export',
          'fare:view', 'fare:edit',
          'settings:view', 'settings:edit',
          'admins:manage'
        ];
        break;

      case 'executive-manager':
        this.permissions = [
          'drivers:view',           // Can view drivers only
          'rides:view',             // Can view rides
          'rides:manage',           // Can manage ride status
          'rides:manual_booking',   // Can create manual bookings
          'queue:view',             // Can view queue
          'queue:manage'            // Can manage queue
          // NO users:view - Cannot view users list
          // NO financial:view - Cannot view financial dashboard/reports
          // NO drivers:create, drivers:edit, drivers:delete, drivers:verify
          // NO users:create, users:edit
          // NO fare:view, fare:edit
          // NO settings:view, settings:edit
          // NO admins:manage
          // NO financial:export
        ];
        break;

      case 'admin':
      default:
        // Regular admin has full access (same as super-admin)
        this.permissions = [
          'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
          'rides:view', 'rides:manage', 'rides:manual_booking',
          'users:view', 'users:create', 'users:edit',
          'queue:view', 'queue:manage',
          'financial:view', 'financial:export',
          'fare:view', 'fare:edit',
          'settings:view', 'settings:edit',
          'admins:manage'
        ];
        break;
    }
  }

  // Encrypt password using bcrypt
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Match user entered password to hashed password in database
AdminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

AdminSchema.statics.createDefaultAdmin = async function() {
  const existing = await this.findOne({ email: 'admin@admin.com' });
  if (!existing) {
    const admin = new this({
      name: 'Admin',
      email: 'admin@admin.com',
      password: 'admin@123',
      role: 'admin'
    });
    await admin.save();
    console.log('Default admin created: admin@admin.com / admin@123');
  } else {
    console.log('Default admin already exists.');
  }
};

// Update existing admin permissions to match current role definitions
AdminSchema.statics.updateAdminPermissions = async function() {
  try {
    const admins = await this.find({});
    let updatedCount = 0;

    for (const admin of admins) {
      // Get the expected permissions for this role
      let expectedPermissions = [];

      if (admin.role === 'super-admin') {
        expectedPermissions = [
          'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
          'rides:view', 'rides:manage', 'rides:manual_booking',
          'users:view', 'users:create', 'users:edit',
          'queue:view', 'queue:manage',
          'financial:view', 'financial:export',
          'fare:view', 'fare:edit',
          'settings:view', 'settings:edit',
          'admins:manage'
        ];
      } else if (admin.role === 'admin') {
        expectedPermissions = [
          'drivers:view', 'drivers:create', 'drivers:edit', 'drivers:delete', 'drivers:verify',
          'rides:view', 'rides:manage', 'rides:manual_booking',
          'users:view', 'users:create', 'users:edit',
          'queue:view', 'queue:manage',
          'financial:view', 'financial:export',
          'fare:view', 'fare:edit',
          'settings:view', 'settings:edit',
          'admins:manage'
        ];
      } else if (admin.role === 'executive-manager') {
        expectedPermissions = [
          'drivers:view',
          'rides:view',
          'rides:manage',
          'rides:manual_booking',
          'queue:view',
          'queue:manage'
        ];
      }

      // Check if permissions need updating
      const currentPerms = JSON.stringify(admin.permissions?.sort() || []);
      const expectedPerms = JSON.stringify(expectedPermissions.sort());

      if (currentPerms !== expectedPerms) {
        admin.permissions = expectedPermissions;
        await admin.save({ validateBeforeSave: false }); // Skip validation to avoid password re-hash
        updatedCount++;
        console.log(`✅ Updated permissions for admin: ${admin.email} (${admin.role})`);
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} admin(s) with new permissions`);
    } else {
      console.log('✅ All admin permissions are up to date');
    }
  } catch (error) {
    console.error('❌ Error updating admin permissions:', error);
  }
};

module.exports = mongoose.model('Admin', AdminSchema);