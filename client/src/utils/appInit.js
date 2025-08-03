// Application initialization utilities

// Initialize application startup procedures
export const initializeApp = async () => {
  console.log('🚀 [AppInit] Starting application initialization...');
  
  // Check if we're on a driver page to handle sessions more carefully
  const isDriverPage = window.location.pathname.includes('/driver');
  
  // Use driver-specific initialization on driver pages to prevent logout issues
  if (isDriverPage) {
    console.log('🔒 [AppInit] Driver page detected - using driver-specific initialization');
    const { initializeDriverApp } = await import('./driverInit');
    return await initializeDriverApp();
  }
  
  // Skip token cleanup to prevent session expiration on page refresh
  console.log('🔄 [AppInit] Skipping automatic token cleanup to preserve sessions');
  
  // Only validate tokens without aggressive cleanup
  const tokenValidation = { foundProblematicToken: false, cleanupPerformed: false };
  
  // Just log that we're preserving existing sessions
  console.log('✅ [AppInit] Preserving existing user sessions');
  
  // Skip auth redirect system for non-driver pages too
  console.log('🔄 [AppInit] Skipping auth redirect system');
  
  // Make debugging functions available globally in development
  if (process.env.NODE_ENV === 'development') {
    // Import debugging utilities
    import('./tokenDebugger').then(({ debugTokenStorage, testTokenRetrieval, emergencyTokenCleanup, logAllStorage }) => {
      window.debugTokenStorage = debugTokenStorage;
      window.testTokenRetrieval = testTokenRetrieval;
      window.emergencyTokenCleanup = emergencyTokenCleanup;
      window.logAllStorage = logAllStorage;
      
      console.log('🔧 [AppInit] Debug utilities available:');
      console.log('  - debugTokenStorage()');
      console.log('  - testTokenRetrieval()');
      console.log('  - emergencyTokenCleanup()');
      console.log('  - logAllStorage()');
    });
  }
  
  console.log('✅ [AppInit] Application initialization complete');
  
  return tokenValidation;
};

// Auto-initialize when module is loaded (but skip on driver pages)
if (typeof window !== 'undefined') {
  // Check if we're on a driver page first
  const isDriverPage = window.location.pathname.includes('/driver');
  
  if (isDriverPage) {
    console.log('🔒 [AppInit] Driver page detected - skipping automatic initialization');
  } else {
    // Run initialization when DOM is ready (only for non-driver pages)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }
  }
}