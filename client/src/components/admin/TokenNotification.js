import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const TokenNotification = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleTokenExpiringSoon = (event) => {
      const { expiresIn } = event.detail;
      const minutes = Math.floor(expiresIn / 60);
      
      addNotification({
        id: Date.now(),
        type: 'warning',
        title: 'Session Expiring Soon',
        message: `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''}. It will be refreshed automatically.`,
        duration: 5000
      });
    };

    const handleTokenRefreshed = () => {
      addNotification({
        id: Date.now(),
        type: 'success',
        title: 'Session Extended',
        message: 'Your session has been automatically extended.',
        duration: 3000
      });
    };

    const handleTokenExpired = () => {
      addNotification({
        id: Date.now(),
        type: 'error',
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        duration: 5000
      });
    };

    // Add custom event listeners
    window.addEventListener('tokenExpiringSoon', handleTokenExpiringSoon);
    window.addEventListener('tokenRefreshed', handleTokenRefreshed);
    window.addEventListener('adminTokenExpired', handleTokenExpired);

    return () => {
      window.removeEventListener('tokenExpiringSoon', handleTokenExpiringSoon);
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
      window.removeEventListener('adminTokenExpired', handleTokenExpired);
    };
  }, []);

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after duration
    setTimeout(() => {
      removeNotification(notification.id);
    }, notification.duration);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="text-green-500" />;
      case 'warning':
        return <FaExclamationTriangle className="text-yellow-500" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-500" />;
      default:
        return <FaCheckCircle className="text-blue-500" />;
    }
  };

  const getNotificationStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`max-w-sm p-4 rounded-lg border shadow-lg transition-all duration-300 ${getNotificationStyles(notification.type)}`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 text-lg">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {notification.title}
              </h4>
              <p className="text-sm mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TokenNotification;