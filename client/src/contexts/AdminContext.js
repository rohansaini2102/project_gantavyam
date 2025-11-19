import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const AdminContext = createContext();

// Permission constants (must match backend)
export const PERMISSIONS = {
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

// Provider component
export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load admin data from localStorage
    const loadAdmin = () => {
      try {
        const storedAdmin = localStorage.getItem('admin');
        const token = localStorage.getItem('adminToken');
        const adminDataVersion = localStorage.getItem('adminDataVersion');

        // Version 2: Introduced permissions field for role-based access control
        const CURRENT_VERSION = '2';

        if (storedAdmin && token) {
          const adminData = JSON.parse(storedAdmin);

          // Check if we need to migrate/clear old data
          if (adminDataVersion !== CURRENT_VERSION) {
            console.warn('Admin data version mismatch. User needs to re-login for updated permissions.');
            // Clear old data to force re-login
            localStorage.removeItem('admin');
            localStorage.removeItem('adminToken');
            localStorage.setItem('adminDataVersion', CURRENT_VERSION);
            setAdmin(null);
          } else {
            setAdmin(adminData);
          }
        } else if (!adminDataVersion) {
          // First time with versioning, set the version
          localStorage.setItem('adminDataVersion', CURRENT_VERSION);
        }
      } catch (error) {
        console.error('Error loading admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAdmin();
  }, []);

  // Update admin data (call this after login)
  const updateAdmin = (adminData) => {
    setAdmin(adminData);
    localStorage.setItem('admin', JSON.stringify(adminData));
    localStorage.setItem('adminDataVersion', '2'); // Ensure version is set
  };

  // Clear admin data (call this on logout)
  const clearAdmin = () => {
    setAdmin(null);
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
  };

  // Check if admin has a specific permission
  const hasPermission = (permission) => {
    if (!admin) return false;

    // Both super-admin and regular admin have all permissions
    if (admin.role === 'super-admin' || admin.role === 'admin') return true;

    // For other roles (executive-manager), check if permission is in the admin's permissions array
    return admin.permissions && admin.permissions.includes(permission);
  };

  // Check if admin has ANY of the specified permissions
  const hasAnyPermission = (permissions) => {
    if (!admin) return false;
    if (admin.role === 'super-admin' || admin.role === 'admin') return true;

    return permissions.some(permission =>
      admin.permissions && admin.permissions.includes(permission)
    );
  };

  // Check if admin has ALL of the specified permissions
  const hasAllPermissions = (permissions) => {
    if (!admin) return false;
    if (admin.role === 'super-admin' || admin.role === 'admin') return true;

    return permissions.every(permission =>
      admin.permissions && admin.permissions.includes(permission)
    );
  };

  // Get role display name
  const getRoleDisplayName = () => {
    if (!admin) return '';

    switch (admin.role) {
      case 'super-admin':
        return 'Super Admin';
      case 'executive-manager':
        return 'Executive Manager';
      case 'admin':
        return 'Admin';
      default:
        return admin.role;
    }
  };

  // Check if user is super admin
  const isSuperAdmin = () => {
    return admin && admin.role === 'super-admin';
  };

  // Check if user is executive manager
  const isExecutiveManager = () => {
    return admin && admin.role === 'executive-manager';
  };

  const value = {
    admin,
    loading,
    updateAdmin,
    clearAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getRoleDisplayName,
    isSuperAdmin,
    isExecutiveManager,
    PERMISSIONS
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

// Custom hook to use the admin context
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export default AdminContext;
