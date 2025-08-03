// Driver-specific initialization utilities
// This file is imported only on driver pages and performs NO token cleanup

// Initialize driver-specific startup procedures
export const initializeDriverApp = async () => {
  console.log('🚗 [DriverInit] Starting driver-specific initialization...');
  
  // Only perform driver-friendly initialization
  console.log('🔒 [DriverInit] Preserving all driver authentication state');
  
  // Check if driver is already logged in
  const driverToken = localStorage.getItem('driverToken');
  const driverData = localStorage.getItem('driver');
  
  if (driverToken && driverData) {
    console.log('✅ [DriverInit] Driver session found and preserved');
    
    // Log driver session info for debugging
    try {
      const payload = JSON.parse(atob(driverToken.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = payload.exp - currentTime;
      
      console.log('🔍 [DriverInit] Driver token info:', {
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        timeUntilExpiry: Math.floor(timeUntilExpiry / 60) + ' minutes',
        isExpired: timeUntilExpiry < 0,
        gracePeriod: timeUntilExpiry < 0 ? 'Within 30min grace period' : 'Active'
      });
    } catch (error) {
      console.log('⚠️ [DriverInit] Token parsing error (continuing anyway):', error.message);
    }
  } else {
    console.log('⚠️ [DriverInit] No driver session found');
  }
  
  // Set up driver-specific event listeners (without cleanup)
  if (typeof window !== 'undefined') {
    // Listen for storage changes to preserve driver state
    window.addEventListener('storage', (e) => {
      if (e.key === 'driverToken' && !e.newValue && e.oldValue) {
        console.log('🚨 [DriverInit] Driver token was removed from storage!');
        // Could implement recovery logic here if needed
      }
    });
    
    // Listen for beforeunload to save driver state
    window.addEventListener('beforeunload', () => {
      const driverToken = localStorage.getItem('driverToken');
      if (driverToken) {
        // Save a backup of the driver token
        try {
          sessionStorage.setItem('driverTokenBackup', driverToken);
          console.log('💾 [DriverInit] Driver token backed up before page unload');
        } catch (error) {
          console.error('❌ [DriverInit] Failed to backup driver token:', error);
        }
      }
    });
    
    // Try to recover driver token if it was backed up
    const backedUpToken = sessionStorage.getItem('driverTokenBackup');
    if (backedUpToken && !localStorage.getItem('driverToken')) {
      console.log('🔄 [DriverInit] Recovering driver token from backup');
      localStorage.setItem('driverToken', backedUpToken);
      sessionStorage.removeItem('driverTokenBackup');
    }
    
    console.log('✅ [DriverInit] Driver-specific event listeners set up');
  }
  
  console.log('✅ [DriverInit] Driver initialization complete (no cleanup performed)');
  
  return {
    success: true,
    cleanupPerformed: false,
    message: 'Driver initialization complete'
  };
};

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.initializeDriverApp = initializeDriverApp;
  console.log('🔧 [DriverInit] Driver initialization available globally');
}

export default initializeDriverApp;