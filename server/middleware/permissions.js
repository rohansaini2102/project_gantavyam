// middleware/permissions.js
// Permission-based access control middleware for admin routes

// Permission constants
const PERMISSIONS = {
  // Driver Management
  DRIVERS_VIEW: 'drivers:view',
  DRIVERS_CREATE: 'drivers:create',
  DRIVERS_EDIT: 'drivers:edit',
  DRIVERS_DELETE: 'drivers:delete',
  DRIVERS_VERIFY: 'drivers:verify',

  // Ride Management
  RIDES_VIEW: 'rides:view',
  RIDES_MANAGE: 'rides:manage',
  RIDES_MANUAL_BOOKING: 'rides:manual_booking',

  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',

  // Queue Management
  QUEUE_VIEW: 'queue:view',
  QUEUE_MANAGE: 'queue:manage',

  // Financial
  FINANCIAL_VIEW: 'financial:view',
  FINANCIAL_EXPORT: 'financial:export',

  // Fare Management
  FARE_VIEW: 'fare:view',
  FARE_EDIT: 'fare:edit',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',

  // Admin Management
  ADMINS_MANAGE: 'admins:manage'
};

/**
 * Check if admin has a single required permission
 * @param {string} requiredPermission - The permission to check
 * @returns {Function} Express middleware function
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super-admin bypasses all permission checks
      if (admin.role === 'super-admin') {
        return next();
      }

      // Check if admin has the required permission
      if (!admin.permissions || !admin.permissions.includes(requiredPermission)) {
        console.log(`❌ Permission denied: Admin ${admin.email} (role: ${admin.role}) tried to access ${requiredPermission}`);
        console.log(`   Admin permissions:`, admin.permissions);

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: requiredPermission,
          message: `You do not have permission to perform this action. Required: ${requiredPermission}`
        });
      }

      console.log(`✅ Permission granted: Admin ${admin.email} accessing ${requiredPermission}`);
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
};

/**
 * Check if admin has ANY of the required permissions (OR logic)
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
const checkAnyPermission = (permissions = []) => {
  return async (req, res, next) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super-admin bypasses all checks
    if (admin.role === 'super-admin') {
      return next();
    }

    const hasPermission = permissions.some(perm =>
      admin.permissions && admin.permissions.includes(perm)
    );

    if (!hasPermission) {
      console.log(`❌ Permission denied: Admin ${admin.email} needs one of:`, permissions);
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permissions,
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

/**
 * Check if admin has ALL required permissions (AND logic)
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
const checkAllPermissions = (permissions = []) => {
  return async (req, res, next) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super-admin bypasses all checks
    if (admin.role === 'super-admin') {
      return next();
    }

    const hasAllPermissions = permissions.every(perm =>
      admin.permissions && admin.permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      console.log(`❌ Permission denied: Admin ${admin.email} needs all of:`, permissions);
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permissions,
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  PERMISSIONS
};
