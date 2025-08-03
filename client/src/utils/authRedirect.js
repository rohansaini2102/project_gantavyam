// Authentication redirect utilities
import { forceTokenCleanup } from './tokenCleanup';

// Handle automatic logout and redirect when token expires
export const handleTokenExpiration = async (context = null) => {
  console.log('🔄 [AuthRedirect] Handling token expiration...');
  
  // Determine current context
  const currentPath = context || window.location.pathname;
  let redirectPath = '/';
  
  if (currentPath.includes('/admin')) {
    redirectPath = '/admin/login';
  } else if (currentPath.includes('/driver')) {
    redirectPath = '/driver/login';
  } else if (currentPath.includes('/user')) {
    redirectPath = '/user/login';
  }
  
  // Check if we should skip cleanup for driver sessions
  const isDriverPage = currentPath.includes('/driver');
  const driverToken = localStorage.getItem('driverToken');
  
  if (isDriverPage && driverToken) {
    try {
      const payload = JSON.parse(atob(driverToken.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = payload.exp - currentTime;
      const DRIVER_TOKEN_GRACE_PERIOD = 900; // 15 minutes
      
      // If driver token is within grace period, don't perform cleanup
      if (timeUntilExpiry < 0 && Math.abs(timeUntilExpiry) <= DRIVER_TOKEN_GRACE_PERIOD) {
        console.log('⚠️ [AuthRedirect] Skipping cleanup for driver token within grace period');
        return; // Don't redirect or cleanup
      }
    } catch (error) {
      console.error('🔄 [AuthRedirect] Error checking driver token:', error);
    }
  }
  
  // Perform token cleanup
  await forceTokenCleanup();
  
  // Show user notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ff4444;
    color: white;
    padding: 30px;
    border-radius: 10px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 16px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    max-width: 400px;
    text-align: center;
  `;
  notification.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 15px;">⚠️</div>
    <strong>Session Expired</strong><br><br>
    Your session has expired and you have been logged out.<br><br>
    You will be redirected to the login page in 3 seconds...
  `;
  document.body.appendChild(notification);
  
  // Redirect after 3 seconds
  setTimeout(() => {
    window.location.href = redirectPath;
  }, 3000);
};

// Handle automatic logout for specific user roles
export const logoutUser = async (role = 'user') => {
  console.log(`🔄 [AuthRedirect] Logging out ${role}...`);
  
  // Clear tokens
  await forceTokenCleanup();
  
  // Determine redirect path based on role
  let redirectPath = '/';
  switch (role) {
    case 'admin':
      redirectPath = '/admin/login';
      break;
    case 'driver':
      redirectPath = '/driver/login';
      break;
    case 'user':
    default:
      redirectPath = '/user/login';
      break;
  }
  
  // Redirect immediately
  window.location.href = redirectPath;
};

// Force logout with immediate redirect (for critical security issues)
export const forceLogout = async (message = 'Your session has expired') => {
  console.log('🚨 [AuthRedirect] Force logout triggered');
  
  // Clear everything
  await forceTokenCleanup();
  
  // Show critical notification
  alert(message);
  
  // Redirect to main page
  window.location.href = '/';
};

// Check if user should be redirected based on token status
export const checkAuthenticationStatus = async () => {
  console.log('🔍 [AuthRedirect] Checking authentication status...');
  
  const currentPath = window.location.pathname;
  
  // Skip check for public pages
  if (currentPath === '/' || currentPath === '/landing') {
    return { needsRedirect: false };
  }
  
  // Check for tokens
  const hasAdminToken = localStorage.getItem('adminToken');
  const hasDriverToken = localStorage.getItem('driverToken');
  const hasUserToken = localStorage.getItem('userToken');
  
  // Check if we're on a protected page without appropriate token
  if (currentPath.includes('/admin') && !hasAdminToken) {
    return { needsRedirect: true, redirectTo: '/admin/login', reason: 'No admin token' };
  }
  
  if (currentPath.includes('/driver') && !hasDriverToken) {
    return { needsRedirect: true, redirectTo: '/driver/login', reason: 'No driver token' };
  }
  
  if (currentPath.includes('/user') && !hasUserToken) {
    return { needsRedirect: true, redirectTo: '/user/login', reason: 'No user token' };
  }
  
  // If we have a token, validate it with driver-friendly logic
  const tokenToCheck = hasAdminToken || hasDriverToken || hasUserToken;
  if (tokenToCheck) {
    try {
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = payload.exp - currentTime;
      const isDriverToken = !!hasDriverToken;
      const isDriverPage = currentPath.includes('/driver');
      const DRIVER_TOKEN_GRACE_PERIOD = 900; // 15 minutes in seconds
      
      // Check for the known problematic token
      const knownExpiredTime = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;
      if (payload.exp === knownExpiredTime) {
        console.log('🔄 [AuthRedirect] Problematic token detected, redirecting...');
        await handleTokenExpiration();
        return { needsRedirect: true, redirectTo: '/', reason: 'Problematic token' };
      }
      
      // For driver tokens on driver pages, be more lenient
      if (isDriverToken && isDriverPage && timeUntilExpiry < 0) {
        const timeExpired = Math.abs(timeUntilExpiry);
        if (timeExpired <= DRIVER_TOKEN_GRACE_PERIOD) {
          console.log(`⚠️ [AuthRedirect] Driver token expired but within grace period: ${Math.floor(timeExpired / 60)}m ago`);
          return { needsRedirect: false, reason: 'Driver token within grace period' };
        } else {
          console.log(`🔄 [AuthRedirect] Driver token expired beyond grace period: ${Math.floor(timeExpired / 60)}m ago`);
          await handleTokenExpiration();
          return { needsRedirect: true, redirectTo: '/driver/login', reason: 'Driver token expired beyond grace period' };
        }
      }
      
      // For non-driver tokens or non-driver pages, check normally
      if (timeUntilExpiry < 0) {
        console.log('🔄 [AuthRedirect] Token expired, redirecting...');
        await handleTokenExpiration();
        return { needsRedirect: true, redirectTo: '/', reason: 'Token expired' };
      }
    } catch (error) {
      console.error('🔄 [AuthRedirect] Invalid token format:', error);
      // Don't automatically redirect for malformed driver tokens on driver pages
      const isDriverToken = !!hasDriverToken;
      const isDriverPage = currentPath.includes('/driver');
      
      if (isDriverToken && isDriverPage) {
        console.log('⚠️ [AuthRedirect] Malformed driver token on driver page, preserving session');
        return { needsRedirect: false, reason: 'Malformed driver token preserved' };
      }
      
      await handleTokenExpiration();
      return { needsRedirect: true, redirectTo: '/', reason: 'Invalid token' };
    }
  }
  
  return { needsRedirect: false };
};

// Set up global event listeners for token cleanup
export const setupGlobalAuthListeners = () => {
  console.log('🔧 [AuthRedirect] Setting up global auth listeners...');
  
  // Listen for token cleanup events
  window.addEventListener('forceTokenCleanup', async (event) => {
    console.log('🔄 [AuthRedirect] Received force token cleanup event:', event.detail);
    await handleTokenExpiration();
  });
  
  // Listen for token refresh events
  window.addEventListener('tokenRefresh', async (event) => {
    console.log('🔄 [AuthRedirect] Received token refresh event:', event.detail);
    // Just reload the page to get fresh state
    window.location.reload();
  });
  
  // Listen for beforeunload to clean up if needed
  window.addEventListener('beforeunload', () => {
    // Don't clean up on normal page navigation
    // Only clean up if we detect problematic tokens
    const problematicTokenTime = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;
    
    ['adminToken', 'driverToken', 'userToken'].forEach(key => {
      const token = localStorage.getItem(key);
      if (token && token.includes('.')) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp === problematicTokenTime) {
            console.log('🔄 [AuthRedirect] Cleaning up problematic token on page unload');
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          }
        } catch (error) {
          // Ignore errors on unload
        }
      }
    });
  });
  
  console.log('✅ [AuthRedirect] Global auth listeners set up');
};

// Initialize auth redirect system
export const initializeAuthRedirect = async () => {
  console.log('🚀 [AuthRedirect] Initializing auth redirect system...');
  
  // Set up global listeners
  setupGlobalAuthListeners();
  
  // Check authentication status
  const authStatus = await checkAuthenticationStatus();
  
  if (authStatus.needsRedirect) {
    console.log('🔄 [AuthRedirect] Redirect needed:', authStatus.reason);
    // Don't redirect immediately, let the app handle it
    return authStatus;
  }
  
  console.log('✅ [AuthRedirect] Auth redirect system initialized');
  return authStatus;
};

// Make functions available globally for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.handleTokenExpiration = handleTokenExpiration;
  window.logoutUser = logoutUser;
  window.forceLogout = forceLogout;
  window.checkAuthenticationStatus = checkAuthenticationStatus;
}