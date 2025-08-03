// Emergency token cleanup utility
// This will be called automatically on app startup and can be triggered manually

const PROBLEMATIC_TOKEN_TIMESTAMP = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;

export const forceTokenCleanup = async () => {
  console.log('🚨 [TokenCleanup] === EMERGENCY TOKEN CLEANUP ===');
  
  // Skip cleanup entirely on driver pages to prevent logout issues
  const isDriverPage = window.location.pathname.includes('/driver');
  if (isDriverPage) {
    console.log('🚫 [TokenCleanup] Skipping force cleanup on driver page');
    return {
      success: false,
      clearedTokens: 0,
      message: 'Cleanup skipped on driver page'
    };
  }
  
  // Import cleanup functions only for non-driver pages
  const { validateAllTokensOnStartup, nukeAllTokens } = await import('./tokenUtils');
  
  // 1. First, run the comprehensive token validation
  const validation = validateAllTokensOnStartup();
  
  if (validation.foundProblematicToken) {
    console.log('🚨 [TokenCleanup] Problematic token found and removed!');
  }
  
  // 2. Nuclear option - clear ALL storage
  console.log('🔥 [TokenCleanup] Performing nuclear token cleanup...');
  nukeAllTokens();
  
  // 3. Clear any cached data that might be related
  try {
    // Clear IndexedDB if it exists
    if (window.indexedDB) {
      const databases = await window.indexedDB.databases();
      for (const db of databases) {
        if (db.name.toLowerCase().includes('auth') || 
            db.name.toLowerCase().includes('token') ||
            db.name.toLowerCase().includes('user')) {
          console.log(`[TokenCleanup] Clearing IndexedDB: ${db.name}`);
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    }
  } catch (error) {
    console.error('[TokenCleanup] Error clearing IndexedDB:', error);
  }
  
  // 4. Clear service worker cache if it exists
  try {
    if ('serviceWorker' in navigator && 'caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`[TokenCleanup] Cleared cache: ${cacheName}`);
      }
    }
  } catch (error) {
    console.error('[TokenCleanup] Error clearing service worker cache:', error);
  }
  
  // 5. Clear cookies that might contain auth data
  try {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      const cleanName = name.trim().toLowerCase();
      
      if (cleanName.includes('token') || cleanName.includes('auth') || 
          cleanName.includes('session') || cleanName.includes('jwt')) {
        console.log(`[TokenCleanup] Clearing cookie: ${name.trim()}`);
        document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
      }
    });
  } catch (error) {
    console.error('[TokenCleanup] Error clearing cookies:', error);
  }
  
  // 6. Force disconnect any existing socket connections
  try {
    const { forceDisconnectSocket } = await import('../services/socket');
    forceDisconnectSocket();
    console.log('[TokenCleanup] Forced socket disconnection');
  } catch (error) {
    console.error('[TokenCleanup] Error disconnecting socket:', error);
  }
  
  // 7. Clear axios default headers
  try {
    const { clearAxiosHeaders } = await import('../services/api');
    if (clearAxiosHeaders) {
      clearAxiosHeaders();
      console.log('[TokenCleanup] Cleared axios headers');
    }
  } catch (error) {
    console.error('[TokenCleanup] Error clearing axios headers:', error);
  }
  
  // 8. Emit cleanup event for components to react
  window.dispatchEvent(new CustomEvent('forceTokenCleanup', {
    detail: { 
      reason: 'Emergency cleanup',
      timestamp: new Date().toISOString(),
      clearedTokens: validation.clearedTokens
    }
  }));
  
  console.log('✅ [TokenCleanup] Emergency cleanup complete');
  console.log('🔄 [TokenCleanup] Page reload recommended');
  
  return {
    success: true,
    clearedTokens: validation.clearedTokens.length,
    message: 'Emergency token cleanup completed'
  };
};

// Check if we need to run cleanup on startup
export const checkAndRunCleanup = async () => {
  console.log('🔍 [TokenCleanup] Checking if cleanup is needed...');
  
  // Skip cleanup entirely on driver pages to prevent logout issues
  const isDriverPage = window.location.pathname.includes('/driver');
  if (isDriverPage) {
    console.log('🚫 [TokenCleanup] Skipping ALL cleanup on driver page - no token checks performed');
    return false;
  }
  
  // Check for the specific problematic token
  const tokenKeys = ['adminToken', 'userToken', 'driverToken'];
  let needsCleanup = false;
  const currentTime = Date.now() / 1000;
  const DRIVER_TOKEN_GRACE_PERIOD = 1800; // 30 minutes - increased for stability
  
  for (const tokenKey of tokenKeys) {
    const token = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    if (token && token.includes('.')) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Always clean up the known problematic token
        if (payload.exp === PROBLEMATIC_TOKEN_TIMESTAMP) {
          console.log(`🚨 [TokenCleanup] Found problematic token: ${tokenKey}`);
          needsCleanup = true;
          break;
        }
        
        // For driver tokens, be more lenient
        if (tokenKey === 'driverToken') {
          const timeUntilExpiry = payload.exp - currentTime;
          const isDriverPage = window.location.pathname.includes('/driver');
          
          // Only mark for cleanup if expired beyond grace period AND not on driver page
          if (timeUntilExpiry < 0 && Math.abs(timeUntilExpiry) > DRIVER_TOKEN_GRACE_PERIOD) {
            if (!isDriverPage) {
              console.log(`🚨 [TokenCleanup] Driver token expired beyond grace period`);
              needsCleanup = true;
              break;
            } else {
              console.log(`⚠️ [TokenCleanup] Driver token expired but preserving on driver page`);
            }
          } else if (timeUntilExpiry < 0) {
            console.log(`⚠️ [TokenCleanup] Driver token expired but within grace period, preserving`);
          }
        }
      } catch (error) {
        // Don't trigger cleanup for malformed driver tokens
        if (tokenKey !== 'driverToken') {
          console.log(`🚨 [TokenCleanup] Found malformed token: ${tokenKey}`);
          needsCleanup = true;
          break;
        } else {
          console.log(`⚠️ [TokenCleanup] Malformed driver token detected but preserved`);
        }
      }
    }
  }
  
  if (needsCleanup) {
    console.log('🚨 [TokenCleanup] Cleanup required - running now...');
    await forceTokenCleanup();
    return true;
  }
  
  console.log('✅ [TokenCleanup] No cleanup needed');
  return false;
};

// Manual cleanup trigger with user confirmation
export const manualCleanup = async () => {
  const userConfirmed = window.confirm(
    'This will clear all authentication tokens and force you to log in again. Are you sure?'
  );
  
  if (userConfirmed) {
    await forceTokenCleanup();
    alert('Token cleanup complete. The page will reload now.');
    window.location.reload();
  }
};

// Add cleanup button to console for debugging
if (typeof window !== 'undefined') {
  window.cleanupTokens = manualCleanup;
  window.forceTokenCleanup = forceTokenCleanup;
  console.log('🔧 [TokenCleanup] Debug functions available:');
  console.log('  - window.cleanupTokens() - Manual cleanup with confirmation');
  console.log('  - window.forceTokenCleanup() - Force cleanup without confirmation');
}