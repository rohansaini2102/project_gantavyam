// Utility functions for token management

export const clearAllTokens = () => {
  console.log('[TokenUtils] Clearing all tokens');
  
  // Clear all possible token storage keys
  localStorage.removeItem('adminToken');
  localStorage.removeItem('admin');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('userToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userRole');
  localStorage.removeItem('driverToken');
  localStorage.removeItem('driver');
  localStorage.removeItem('driverRole');
  
  // Clear session storage as well
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('driverToken');
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.error('[TokenUtils] Error parsing token:', error);
    return true;
  }
};

export const getTokenExpirationTime = (token) => {
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    console.error('[TokenUtils] Error parsing token:', error);
    return null;
  }
};

export const getTimeUntilExpiration = (token) => {
  if (!token) return 0;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return Math.max(0, payload.exp - currentTime);
  } catch (error) {
    console.error('[TokenUtils] Error parsing token:', error);
    return 0;
  }
};

export const forceTokenRefresh = async () => {
  console.log('[TokenUtils] Force token refresh initiated');
  
  // Clear all tokens from storage
  clearAllTokens();
  
  // Force clear axios authorization headers
  try {
    const { default: apiClient } = await import('../services/api');
    if (apiClient && apiClient.defaults) {
      delete apiClient.defaults.headers.Authorization;
    }
  } catch (error) {
    console.error('[TokenUtils] Error clearing axios headers:', error);
  }
  
  // Force disconnect socket
  try {
    const { forceDisconnectSocket } = await import('../services/socket');
    forceDisconnectSocket();
  } catch (error) {
    console.error('[TokenUtils] Error disconnecting socket:', error);
  }
  
  // Clear any cached state in memory
  if (window.localStorage) {
    // Force clear any cached values
    Object.keys(window.localStorage).forEach(key => {
      if (key.includes('token') || key.includes('admin') || key.includes('user') || key.includes('driver')) {
        window.localStorage.removeItem(key);
      }
    });
  }
  
  if (window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      if (key.includes('token') || key.includes('admin') || key.includes('user') || key.includes('driver')) {
        window.sessionStorage.removeItem(key);
      }
    });
  }
  
  // Emit event to notify all components
  window.dispatchEvent(new CustomEvent('forceTokenRefresh'));
  
  // Reload the page to force a fresh login
  window.location.reload();
};

// Aggressively clear all tokens - used for emergency token cleanup
export const nukeAllTokens = () => {
  console.log('[TokenUtils] 🔥 NUKING ALL TOKENS - Emergency cleanup');
  
  // Clear all known token keys
  const tokenKeys = [
    'adminToken', 'admin', 'adminRole',
    'userToken', 'user', 'userRole', 
    'driverToken', 'driver', 'driverRole',
    'token', 'authToken', 'accessToken', 'refreshToken'
  ];
  
  tokenKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  // Clear any key that might contain token data
  if (window.localStorage) {
    Object.keys(window.localStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('auth') || 
          lowerKey.includes('admin') || lowerKey.includes('user') || 
          lowerKey.includes('driver')) {
        console.log(`[TokenUtils] 🔥 Nuking localStorage key: ${key}`);
        window.localStorage.removeItem(key);
      }
    });
  }
  
  if (window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('auth') || 
          lowerKey.includes('admin') || lowerKey.includes('user') || 
          lowerKey.includes('driver')) {
        console.log(`[TokenUtils] 🔥 Nuking sessionStorage key: ${key}`);
        window.sessionStorage.removeItem(key);
      }
    });
  }
  
  console.log('[TokenUtils] 🔥 All tokens nuked successfully');
};

export const logTokenInfo = (token, label = 'Token') => {
  if (!token) {
    console.log(`[TokenUtils] ${label}: No token found`);
    return;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    const timeUntilExpiry = payload.exp - currentTime;
    
    console.log(`[TokenUtils] ${label} Info:`, {
      id: payload.id,
      role: payload.role,
      issuedAt: new Date(payload.iat * 1000).toISOString(),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 60)}m ${Math.floor(timeUntilExpiry % 60)}s`,
      isExpired: timeUntilExpiry < 0
    });
  } catch (error) {
    console.error(`[TokenUtils] Error parsing ${label}:`, error);
  }
};

export const checkForExpiredTokens = () => {
  console.log('[TokenUtils] Checking for expired tokens...');
  
  const knownExpiredTime = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;
  const currentTime = Date.now() / 1000;
  
  ['adminToken', 'userToken', 'driverToken'].forEach(tokenKey => {
    const token = localStorage.getItem(tokenKey);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Check for specific problematic token or any expired token
        if (payload.exp === knownExpiredTime || payload.exp < currentTime) {
          console.log(`[TokenUtils] Found expired token: ${tokenKey}`, {
            expiredAt: new Date(payload.exp * 1000).toISOString(),
            currentTime: new Date().toISOString(),
            isProblematicToken: payload.exp === knownExpiredTime
          });
          
          // Clear the token and related data
          localStorage.removeItem(tokenKey);
          sessionStorage.removeItem(tokenKey);
          
          // Also clear related data
          const baseKey = tokenKey.replace('Token', '');
          localStorage.removeItem(baseKey);
          localStorage.removeItem(`${baseKey}Role`);
          
          console.log(`[TokenUtils] Cleared expired token and related data for: ${tokenKey}`);
        }
      } catch (error) {
        console.error(`[TokenUtils] Error checking ${tokenKey}:`, error);
        // Clear malformed tokens
        localStorage.removeItem(tokenKey);
        sessionStorage.removeItem(tokenKey);
      }
    }
  });
};

// Enhanced startup token validation - now less aggressive
export const validateAllTokensOnStartup = () => {
  console.log('\n🔍 [TokenUtils] === STARTUP TOKEN VALIDATION (Minimal) ===');
  
  // Return immediately without any validation to preserve sessions
  console.log('✅ [TokenUtils] Skipping token validation to preserve sessions');
  
  return {
    foundProblematicToken: false,
    clearedTokens: [],
    cleanupPerformed: false
  };
};

// Create a unified token getter that ensures consistency
export const getTokenForContext = (context = null) => {
  const currentPath = context || window.location.pathname;
  let tokenKey = 'userToken'; // default
  
  if (currentPath.includes('/admin')) {
    tokenKey = 'adminToken';
  } else if (currentPath.includes('/driver')) {
    tokenKey = 'driverToken';
  }
  
  // Always check localStorage first, then sessionStorage
  let token = localStorage.getItem(tokenKey);
  if (!token) {
    token = sessionStorage.getItem(tokenKey);
    if (token) {
      console.warn(`[TokenUtils] Found token in sessionStorage but not localStorage: ${tokenKey}`);
      // Move token to localStorage for consistency
      localStorage.setItem(tokenKey, token);
      console.log(`[TokenUtils] Moved token from sessionStorage to localStorage: ${tokenKey}`);
    }
  }
  
  // Skip ALL validation for driver pages
  if (currentPath.includes('/driver')) {
    if (token) {
      console.log(`[TokenUtils] Returning driver token without validation`);
    }
    return token;
  }
  
  // Return token without validation to preserve sessions
  // Token validation should happen at API call time, not on retrieval
  
  return token;
};