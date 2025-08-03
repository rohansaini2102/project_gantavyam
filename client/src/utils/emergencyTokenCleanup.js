// Emergency token cleanup for immediate execution
const KNOWN_EXPIRED_TOKEN_TIME = '2025-07-18T01:35:34.000Z';
const EXPIRED_TIMESTAMP = new Date(KNOWN_EXPIRED_TOKEN_TIME).getTime() / 1000;

// Nuclear cleanup function that runs immediately
export const emergencyTokenCleanup = () => {
  console.log('🚨 [EmergencyCleanup] Running immediate token cleanup...');
  
  // Check if we're on a driver page - be more lenient
  const isDriverPage = window.location.pathname.includes('/driver');
  const isDriverDashboard = window.location.pathname.includes('/driver/dashboard');
  
  // Skip ALL cleanup on ANY driver page to prevent logout issues
  if (isDriverPage) {
    console.log('🚫 [EmergencyCleanup] Skipping aggressive cleanup on driver page');
    return false;
  }
  
  let cleanupPerformed = false;
  const currentTime = Date.now() / 1000;
  const DRIVER_TOKEN_GRACE_PERIOD = 900; // 15 minutes in seconds
  
  // Clear all possible token storage locations
  const tokenKeys = [
    'adminToken', 'driverToken', 'userToken',
    'admin', 'driver', 'user',
    'adminRole', 'driverRole', 'userRole',
    'authToken', 'token', 'jwt',
    'driverStatus', 'driverQueuePosition', 'driverActiveRide', 'driverLastKnownState'
  ];
  
  // Check and clear localStorage
  tokenKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      // Check if it's a JWT token
      if (value.includes('.') && value.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(value.split('.')[1]));
          const isDriverToken = key === 'driverToken' || key.toLowerCase().includes('driver');
          
          // Always remove the specific problematic token
          if (payload.exp === EXPIRED_TIMESTAMP) {
            console.log(`🚨 [EmergencyCleanup] Removing problematic token from localStorage: ${key}`);
            localStorage.removeItem(key);
            cleanupPerformed = true;
          } else if (isDriverToken && isDriverPage) {
            // For driver tokens on driver pages, be more lenient
            const timeUntilExpiry = payload.exp - currentTime;
            if (timeUntilExpiry < 0 && Math.abs(timeUntilExpiry) > DRIVER_TOKEN_GRACE_PERIOD) {
              console.log(`🚨 [EmergencyCleanup] Driver token expired beyond grace period: ${key}`);
              localStorage.removeItem(key);
              cleanupPerformed = true;
            } else {
              console.log(`⚠️ [EmergencyCleanup] Preserving driver token: ${key}`);
            }
          } else if (!isDriverToken && payload.exp < currentTime) {
            // For non-driver tokens, remove if expired
            console.log(`🚨 [EmergencyCleanup] Removing expired token from localStorage: ${key}`);
            localStorage.removeItem(key);
            cleanupPerformed = true;
          }
        } catch (error) {
          // If token is malformed, be careful with driver tokens
          const isDriverToken = key === 'driverToken' || key.toLowerCase().includes('driver');
          if (!isDriverToken || !isDriverPage) {
            console.log(`🚨 [EmergencyCleanup] Removing malformed token from localStorage: ${key}`);
            localStorage.removeItem(key);
            cleanupPerformed = true;
          } else {
            console.log(`⚠️ [EmergencyCleanup] Preserving malformed driver token: ${key}`);
          }
        }
      } else if (key === 'driverToken' || key.toLowerCase().includes('driver')) {
        // Don't remove driver data unless we're sure it's problematic
        if (!isDriverPage) {
          localStorage.removeItem(key);
          cleanupPerformed = true;
        }
      } else {
        // Remove any other auth-related data
        localStorage.removeItem(key);
        cleanupPerformed = true;
      }
    }
  });
  
  // Check and clear sessionStorage
  tokenKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    if (value) {
      if (value.includes('.') && value.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(value.split('.')[1]));
          const isDriverToken = key === 'driverToken' || key.toLowerCase().includes('driver');
          
          // Always remove the specific problematic token
          if (payload.exp === EXPIRED_TIMESTAMP) {
            console.log(`🚨 [EmergencyCleanup] Removing problematic token from sessionStorage: ${key}`);
            sessionStorage.removeItem(key);
            cleanupPerformed = true;
          } else if (isDriverToken && isDriverPage) {
            // For driver tokens on driver pages, be more lenient
            const timeUntilExpiry = payload.exp - currentTime;
            if (timeUntilExpiry < 0 && Math.abs(timeUntilExpiry) > DRIVER_TOKEN_GRACE_PERIOD) {
              console.log(`🚨 [EmergencyCleanup] Driver token expired beyond grace period: ${key}`);
              sessionStorage.removeItem(key);
              cleanupPerformed = true;
            } else {
              console.log(`⚠️ [EmergencyCleanup] Preserving driver token: ${key}`);
            }
          } else if (!isDriverToken && payload.exp < currentTime) {
            // For non-driver tokens, remove if expired
            console.log(`🚨 [EmergencyCleanup] Removing expired token from sessionStorage: ${key}`);
            sessionStorage.removeItem(key);
            cleanupPerformed = true;
          }
        } catch (error) {
          // If token is malformed, be careful with driver tokens
          const isDriverToken = key === 'driverToken' || key.toLowerCase().includes('driver');
          if (!isDriverToken || !isDriverPage) {
            console.log(`🚨 [EmergencyCleanup] Removing malformed token from sessionStorage: ${key}`);
            sessionStorage.removeItem(key);
            cleanupPerformed = true;
          } else {
            console.log(`⚠️ [EmergencyCleanup] Preserving malformed driver token: ${key}`);
          }
        }
      } else if (key === 'driverToken' || key.toLowerCase().includes('driver')) {
        // Don't remove driver data unless we're sure it's problematic
        if (!isDriverPage) {
          sessionStorage.removeItem(key);
          cleanupPerformed = true;
        }
      } else {
        // Remove any other auth-related data
        sessionStorage.removeItem(key);
        cleanupPerformed = true;
      }
    }
  });
  
  // Clear all cookies
  document.cookie.split(";").forEach(cookie => {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  });
  
  if (cleanupPerformed) {
    console.log('🚨 [EmergencyCleanup] ✅ Expired tokens removed successfully');
    
    // Show user notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-width: 300px;
    `;
    notification.innerHTML = `
      <strong>🚨 Session Expired</strong><br>
      Your expired session has been cleared.<br>
      <button onclick="window.location.reload()" style="background: white; color: #ff4444; border: none; padding: 5px 10px; margin-top: 10px; border-radius: 3px; cursor: pointer;">Refresh Page</button>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
    
    return true;
  }
  
  console.log('🚨 [EmergencyCleanup] No expired tokens found');
  return false;
};

// Make available globally for manual cleanup (only run when explicitly called)
if (typeof window !== 'undefined') {
  window.emergencyTokenCleanup = emergencyTokenCleanup;
  console.log('🔧 [EmergencyCleanup] Available globally but will not run automatically');
}

export default emergencyTokenCleanup;