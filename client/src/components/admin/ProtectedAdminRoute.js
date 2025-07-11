import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProtectedAdminRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        console.log('🔒 [Admin Auth] No admin token found, redirecting to login');
        navigate('/admin/login');
        return;
      }

      try {
        // Validate token format and expiration
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 <= Date.now();
        
        if (isExpired) {
          console.log('🔒 [Admin Auth] Token expired, redirecting to login');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('admin');
          navigate('/admin/login');
          return;
        }

        console.log('🔒 [Admin Auth] Valid token found, granting access');
        setIsAuthenticated(true);
      } catch (error) {
        console.error('🔒 [Admin Auth] Invalid token format:', error);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/admin/login');
        return;
      }
      
      setIsLoading(false);
    };

    checkAuthStatus();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return children;
};

export default ProtectedAdminRoute;