// Unified token management service
import { validateAllTokensOnStartup, getTokenForContext } from '../utils/tokenUtils';

class TokenService {
  constructor() {
    this.initializeService();
  }

  initializeService() {
    // Skip ALL validation during service initialization to prevent logout
    console.log('🔒 [TokenService] Service initialized - preserving existing sessions');
    // No token validation or cleanup on startup
  }

  // Get token for current context with validation
  getToken(context = null) {
    const currentPath = context || window.location.pathname;
    const isDriverPage = currentPath.includes('/driver');
    
    if (isDriverPage) {
      // For driver pages, just return the token without validation
      let tokenKey = 'driverToken';
      const token = localStorage.getItem(tokenKey);
      if (token) {
        console.log(`[TokenService] Retrieved driver token (validation skipped)`);
        return token;
      }
      return null;
    }
    
    const token = getTokenForContext(context);
    
    if (token) {
      // Log token info for debugging (non-driver pages only)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log(`[TokenService] Retrieved valid token:`, {
          context: context || window.location.pathname,
          role: payload.role,
          exp: new Date(payload.exp * 1000).toISOString(),
          timeUntilExpiry: Math.floor((payload.exp - Date.now() / 1000) / 60) + ' minutes'
        });
      } catch (error) {
        console.error('[TokenService] Error parsing token:', error);
      }
    } else {
      console.log(`[TokenService] No valid token found for context: ${context || window.location.pathname}`);
    }
    
    return token;
  }

  // Store token with proper cleanup
  setToken(tokenType, token, additionalData = {}) {
    if (!token) {
      console.error('[TokenService] Attempted to set null/undefined token');
      return false;
    }

    // Skip validation for driver tokens
    if (tokenType === 'driver') {
      try {
        // Clear any existing tokens first
        this.clearTokensForType(tokenType);

        // Store new token without validation
        localStorage.setItem(`${tokenType}Token`, token);
        localStorage.setItem(`${tokenType}Role`, tokenType);
        
        if (additionalData.user) {
          localStorage.setItem(tokenType, JSON.stringify(additionalData.user));
        }

        console.log(`[TokenService] Successfully stored ${tokenType} token (validation skipped)`);
        return true;
      } catch (error) {
        console.error(`[TokenService] Error storing ${tokenType} token:`, error);
        return false;
      }
    }

    try {
      // Validate token format for non-driver tokens
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Only block truly expired tokens (with some grace period)
      const currentTime = Date.now() / 1000;
      const GRACE_PERIOD = 300; // 5 minutes grace period
      
      if (payload.exp < (currentTime - GRACE_PERIOD)) {
        console.error('[TokenService] 🚫 BLOCKED: Attempted to store expired token');
        return false;
      }

      // Clear any existing tokens first
      this.clearTokensForType(tokenType);

      // Store new token
      localStorage.setItem(`${tokenType}Token`, token);
      localStorage.setItem(`${tokenType}Role`, tokenType);
      
      if (additionalData.user) {
        localStorage.setItem(tokenType, JSON.stringify(additionalData.user));
      }

      console.log(`[TokenService] Successfully stored ${tokenType} token`);
      return true;
    } catch (error) {
      console.error(`[TokenService] Error storing ${tokenType} token:`, error);
      return false;
    }
  }

  // Clear tokens for a specific type
  clearTokensForType(tokenType) {
    const keys = [`${tokenType}Token`, tokenType, `${tokenType}Role`];
    
    keys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log(`[TokenService] Cleared all ${tokenType} tokens`);
  }

  // Clear all tokens
  clearAllTokens() {
    const tokenTypes = ['admin', 'user', 'driver'];
    tokenTypes.forEach(type => this.clearTokensForType(type));
    
    // Also clear any generic token keys
    const genericKeys = ['token', 'authToken', 'accessToken', 'refreshToken'];
    genericKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log('[TokenService] Cleared all tokens');
  }

  // Check if token exists and is valid
  hasValidToken(context = null) {
    const token = this.getToken(context);
    return !!token;
  }

  // Get token info without validation (for debugging)
  getTokenInfo(context = null) {
    const currentPath = context || window.location.pathname;
    let tokenKey = 'userToken';
    
    if (currentPath.includes('/admin')) {
      tokenKey = 'adminToken';
    } else if (currentPath.includes('/driver')) {
      tokenKey = 'driverToken';
    }
    
    const lsToken = localStorage.getItem(tokenKey);
    const ssToken = sessionStorage.getItem(tokenKey);
    
    return {
      tokenKey,
      localStorage: lsToken ? {
        exists: true,
        length: lsToken.length,
        start: lsToken.substring(0, 20) + '...'
      } : null,
      sessionStorage: ssToken ? {
        exists: true,
        length: ssToken.length,
        start: ssToken.substring(0, 20) + '...'
      } : null,
      consistent: lsToken === ssToken
    };
  }

  // Force token refresh and cleanup
  forceTokenRefresh() {
    console.log('[TokenService] Forcing token refresh...');
    
    // Clear all tokens
    this.clearAllTokens();
    
    // Run validation again
    validateAllTokensOnStartup();
    
    // Notify components
    window.dispatchEvent(new CustomEvent('tokenRefresh'));
    
    console.log('[TokenService] Token refresh complete');
  }
}

// Create singleton instance
const tokenService = new TokenService();

// Export singleton methods
export const getToken = (context) => tokenService.getToken(context);
export const setToken = (tokenType, token, additionalData) => tokenService.setToken(tokenType, token, additionalData);
export const clearTokensForType = (tokenType) => tokenService.clearTokensForType(tokenType);
export const clearAllTokens = () => tokenService.clearAllTokens();
export const hasValidToken = (context) => tokenService.hasValidToken(context);
export const getTokenInfo = (context) => tokenService.getTokenInfo(context);
export const forceTokenRefresh = () => tokenService.forceTokenRefresh();

export default tokenService;