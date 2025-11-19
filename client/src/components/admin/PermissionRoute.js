import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';

/**
 * PermissionRoute - A route wrapper that checks if the user has the required permission
 *
 * @param {React.ReactNode} children - The component to render if permission is granted
 * @param {string} requiredPermission - The permission required to access this route
 * @param {string} fallback - The path to redirect to if permission is denied (default: '/admin')
 *
 * @example
 * <PermissionRoute requiredPermission={PERMISSIONS.FARE_VIEW}>
 *   <FareManagement />
 * </PermissionRoute>
 */
const PermissionRoute = ({ children, requiredPermission, fallback = '/admin' }) => {
  const { hasPermission, admin, loading } = useAdmin();

  // Show loading state while admin data is being loaded
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no admin or permission denied, redirect to fallback
  if (!admin || !hasPermission(requiredPermission)) {
    console.warn(`Access denied: User lacks permission "${requiredPermission}". Redirecting to ${fallback}`);
    return <Navigate to={fallback} replace />;
  }

  // Permission granted, render the component
  return children;
};

export default PermissionRoute;
