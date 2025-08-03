// Token debugging utility to diagnose storage inconsistencies
export const debugTokenStorage = () => {
  console.log('\n🔍 [TokenDebugger] === COMPREHENSIVE TOKEN STORAGE ANALYSIS ===');
  
  const currentTime = Date.now() / 1000;
  const knownExpiredTime = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;
  
  // Check all possible token storage locations
  const allTokenKeys = [
    'adminToken', 'admin', 'adminRole',
    'userToken', 'user', 'userRole',
    'driverToken', 'driver', 'driverRole',
    'token', 'authToken', 'accessToken', 'refreshToken'
  ];
  
  console.log('🔍 [TokenDebugger] Checking localStorage:');
  allTokenKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      if (key.toLowerCase().includes('token') || key === 'token') {
        try {
          const payload = JSON.parse(atob(value.split('.')[1]));
          const isExpired = payload.exp < currentTime;
          const isProblematic = payload.exp === knownExpiredTime;
          
          console.log(`  ✓ ${key}:`, {
            length: value.length,
            start: value.substring(0, 20) + '...',
            exp: new Date(payload.exp * 1000).toISOString(),
            isExpired,
            isProblematic,
            timeDiff: Math.floor((payload.exp - currentTime) / 60) + ' minutes'
          });
        } catch (error) {
          console.log(`  ❌ ${key}: Invalid token format`);
        }
      } else {
        console.log(`  ◦ ${key}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
      }
    }
  });
  
  console.log('\n🔍 [TokenDebugger] Checking sessionStorage:');
  allTokenKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    if (value) {
      if (key.toLowerCase().includes('token') || key === 'token') {
        try {
          const payload = JSON.parse(atob(value.split('.')[1]));
          const isExpired = payload.exp < currentTime;
          const isProblematic = payload.exp === knownExpiredTime;
          
          console.log(`  ✓ ${key}:`, {
            length: value.length,
            start: value.substring(0, 20) + '...',
            exp: new Date(payload.exp * 1000).toISOString(),
            isExpired,
            isProblematic,
            timeDiff: Math.floor((payload.exp - currentTime) / 60) + ' minutes'
          });
        } catch (error) {
          console.log(`  ❌ ${key}: Invalid token format`);
        }
      } else {
        console.log(`  ◦ ${key}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
      }
    }
  });
  
  // Check for any other token-related keys
  console.log('\n🔍 [TokenDebugger] Searching for other token-related keys:');
  if (window.localStorage) {
    Object.keys(window.localStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('token') || lowerKey.includes('auth') || 
           lowerKey.includes('jwt')) && !allTokenKeys.includes(key)) {
        console.log(`  🔍 Found additional localStorage key: ${key}`);
      }
    });
  }
  
  if (window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('token') || lowerKey.includes('auth') || 
           lowerKey.includes('jwt')) && !allTokenKeys.includes(key)) {
        console.log(`  🔍 Found additional sessionStorage key: ${key}`);
      }
    });
  }
  
  // Test current retrieval methods
  console.log('\n🔍 [TokenDebugger] Testing current token retrieval methods:');
  const currentPath = window.location.pathname;
  console.log(`  Current path: ${currentPath}`);
  
  if (currentPath.includes('/admin')) {
    const adminToken = localStorage.getItem('adminToken');
    console.log(`  API would use adminToken: ${adminToken ? 'Found' : 'Not found'}`);
    if (adminToken) {
      try {
        const payload = JSON.parse(atob(adminToken.split('.')[1]));
        console.log(`    Expires: ${new Date(payload.exp * 1000).toISOString()}`);
        console.log(`    Is expired: ${payload.exp < currentTime}`);
        console.log(`    Is problematic: ${payload.exp === knownExpiredTime}`);
      } catch (error) {
        console.log(`    Invalid token format`);
      }
    }
  }
  
  console.log('\n🔍 [TokenDebugger] === END ANALYSIS ===\n');
};

// Test function to simulate API and Socket token retrieval
export const testTokenRetrieval = () => {
  console.log('\n🧪 [TokenDebugger] === TOKEN RETRIEVAL TEST ===');
  
  const currentPath = window.location.pathname;
  console.log(`Current path: ${currentPath}`);
  
  // Simulate API token retrieval logic
  let apiToken = null;
  if (currentPath.includes('/admin')) {
    apiToken = localStorage.getItem('adminToken');
    console.log('🔄 API would retrieve: adminToken');
  } else if (currentPath.includes('/driver')) {
    apiToken = localStorage.getItem('driverToken');
    console.log('🔄 API would retrieve: driverToken');
  } else {
    apiToken = localStorage.getItem('userToken');
    console.log('🔄 API would retrieve: userToken');
  }
  
  // Simulate Socket token retrieval logic
  let socketToken = null;
  if (currentPath.includes('/admin')) {
    socketToken = localStorage.getItem('adminToken');
    console.log('🔌 Socket would retrieve: adminToken');
  } else if (currentPath.includes('/driver')) {
    socketToken = localStorage.getItem('driverToken');
    console.log('🔌 Socket would retrieve: driverToken');
  } else {
    socketToken = localStorage.getItem('userToken');
    console.log('🔌 Socket would retrieve: userToken');
  }
  
  console.log('\n🧪 Results:');
  console.log(`  API Token: ${apiToken ? 'Found' : 'Not found'}`);
  console.log(`  Socket Token: ${socketToken ? 'Found' : 'Not found'}`);
  console.log(`  Tokens Match: ${apiToken === socketToken}`);
  
  if (apiToken && socketToken) {
    try {
      const apiPayload = JSON.parse(atob(apiToken.split('.')[1]));
      const socketPayload = JSON.parse(atob(socketToken.split('.')[1]));
      
      console.log(`  API Token Expires: ${new Date(apiPayload.exp * 1000).toISOString()}`);
      console.log(`  Socket Token Expires: ${new Date(socketPayload.exp * 1000).toISOString()}`);
      console.log(`  Expiry Times Match: ${apiPayload.exp === socketPayload.exp}`);
    } catch (error) {
      console.log(`  Error parsing tokens: ${error.message}`);
    }
  }
  
  console.log('\n🧪 === END TEST ===\n');
};

// Enhanced token cleanup that targets all possible locations
export const emergencyTokenCleanup = () => {
  console.log('\n🚨 [TokenDebugger] === EMERGENCY TOKEN CLEANUP ===');
  
  const beforeCount = {
    localStorage: 0,
    sessionStorage: 0
  };
  
  // Count items before cleanup
  if (window.localStorage) {
    beforeCount.localStorage = Object.keys(window.localStorage).length;
  }
  if (window.sessionStorage) {
    beforeCount.sessionStorage = Object.keys(window.sessionStorage).length;
  }
  
  // Clear all known token keys
  const allTokenKeys = [
    'adminToken', 'admin', 'adminRole',
    'userToken', 'user', 'userRole',
    'driverToken', 'driver', 'driverRole',
    'token', 'authToken', 'accessToken', 'refreshToken',
    'jwt', 'bearerToken', 'sessionToken'
  ];
  
  allTokenKeys.forEach(key => {
    const lsValue = localStorage.getItem(key);
    const ssValue = sessionStorage.getItem(key);
    
    if (lsValue) {
      localStorage.removeItem(key);
      console.log(`  🧹 Cleared localStorage: ${key}`);
    }
    
    if (ssValue) {
      sessionStorage.removeItem(key);
      console.log(`  🧹 Cleared sessionStorage: ${key}`);
    }
  });
  
  // Clear any key that might contain auth data
  if (window.localStorage) {
    Object.keys(window.localStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('auth') || 
          lowerKey.includes('jwt') || lowerKey.includes('bearer')) {
        localStorage.removeItem(key);
        console.log(`  🧹 Cleared additional localStorage: ${key}`);
      }
    });
  }
  
  if (window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('auth') || 
          lowerKey.includes('jwt') || lowerKey.includes('bearer')) {
        sessionStorage.removeItem(key);
        console.log(`  🧹 Cleared additional sessionStorage: ${key}`);
      }
    });
  }
  
  const afterCount = {
    localStorage: window.localStorage ? Object.keys(window.localStorage).length : 0,
    sessionStorage: window.sessionStorage ? Object.keys(window.sessionStorage).length : 0
  };
  
  console.log('\n🚨 Cleanup Summary:');
  console.log(`  localStorage: ${beforeCount.localStorage} → ${afterCount.localStorage} items`);
  console.log(`  sessionStorage: ${beforeCount.sessionStorage} → ${afterCount.sessionStorage} items`);
  console.log(`  Total items cleared: ${(beforeCount.localStorage + beforeCount.sessionStorage) - (afterCount.localStorage + afterCount.sessionStorage)}`);
  
  console.log('\n🚨 === CLEANUP COMPLETE ===\n');
};

// Function to log all storage contents for debugging
export const logAllStorage = () => {
  console.log('\n📋 [TokenDebugger] === ALL STORAGE CONTENTS ===');
  
  console.log('📋 localStorage:');
  if (window.localStorage) {
    Object.keys(window.localStorage).forEach(key => {
      const value = window.localStorage.getItem(key);
      console.log(`  ${key}: ${value && value.length > 100 ? value.substring(0, 100) + '...' : value}`);
    });
  }
  
  console.log('\n📋 sessionStorage:');
  if (window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      const value = window.sessionStorage.getItem(key);
      console.log(`  ${key}: ${value && value.length > 100 ? value.substring(0, 100) + '...' : value}`);
    });
  }
  
  console.log('\n📋 === END STORAGE DUMP ===\n');
};

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.debugTokenStorage = debugTokenStorage;
  window.testTokenRetrieval = testTokenRetrieval;
  window.emergencyTokenCleanup = emergencyTokenCleanup;
  window.logAllStorage = logAllStorage;
}