// Driver state sync debugging utilities
import { driverStateThrottler } from './throttle';

class SyncDebugger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.enabled = process.env.NODE_ENV === 'development';
  }

  log(type, message, data = null) {
    if (!this.enabled) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console output with color coding
    const color = this.getLogColor(type);
    console.log(`%c[SyncDebugger] ${type}: ${message}`, color, data);
  }

  getLogColor(type) {
    switch (type) {
      case 'THROTTLED':
        return 'color: orange; font-weight: bold;';
      case 'RATE_LIMITED':
        return 'color: red; font-weight: bold;';
      case 'SUCCESS':
        return 'color: green; font-weight: bold;';
      case 'ERROR':
        return 'color: red; font-weight: bold;';
      case 'DEBOUNCED':
        return 'color: blue; font-weight: bold;';
      default:
        return 'color: gray;';
    }
  }

  // Get sync statistics
  getStats() {
    const now = Date.now();
    const last5Min = now - 5 * 60 * 1000;
    const last1Min = now - 60 * 1000;
    
    const recentLogs = this.logs.filter(log => new Date(log.timestamp).getTime() > last5Min);
    const veryRecentLogs = this.logs.filter(log => new Date(log.timestamp).getTime() > last1Min);
    
    const stats = {
      totalLogs: this.logs.length,
      last5Minutes: recentLogs.length,
      lastMinute: veryRecentLogs.length,
      throttled: recentLogs.filter(log => log.type === 'THROTTLED').length,
      rateLimited: recentLogs.filter(log => log.type === 'RATE_LIMITED').length,
      successful: recentLogs.filter(log => log.type === 'SUCCESS').length,
      errors: recentLogs.filter(log => log.type === 'ERROR').length,
      debounced: recentLogs.filter(log => log.type === 'DEBOUNCED').length,
      throttlingStatus: driverStateThrottler.getThrottlingStatus('driver_state_sync')
    };
    
    return stats;
  }

  // Display formatted stats
  displayStats() {
    const stats = this.getStats();
    
    console.group('%c[SyncDebugger] Sync Statistics', 'color: blue; font-weight: bold;');
    console.log('📊 Total logs:', stats.totalLogs);
    console.log('📊 Last 5 minutes:', stats.last5Minutes);
    console.log('📊 Last minute:', stats.lastMinute);
    console.log('🚫 Throttled:', stats.throttled);
    console.log('🔴 Rate limited:', stats.rateLimited);
    console.log('✅ Successful:', stats.successful);
    console.log('❌ Errors:', stats.errors);
    console.log('⏱️ Debounced:', stats.debounced);
    console.log('🎛️ Throttling Status:', stats.throttlingStatus);
    console.groupEnd();
    
    return stats;
  }

  // Get recent logs
  getRecentLogs(minutes = 5) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.logs.filter(log => new Date(log.timestamp).getTime() > cutoff);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    console.log('[SyncDebugger] Logs cleared');
  }

  // Export logs for analysis
  exportLogs() {
    const data = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[SyncDebugger] Logs exported');
  }

  // Check if sync is happening too frequently
  checkSyncFrequency() {
    const lastMinuteLogs = this.getRecentLogs(1);
    const syncAttempts = lastMinuteLogs.length;
    
    if (syncAttempts > 5) {
      console.warn(`[SyncDebugger] ⚠️ High sync frequency detected: ${syncAttempts} attempts in last minute`);
      return { highFrequency: true, attempts: syncAttempts };
    }
    
    return { highFrequency: false, attempts: syncAttempts };
  }
}

// Create singleton instance
const syncDebugger = new SyncDebugger();

// Export logging functions
export const logSync = (type, message, data) => syncDebugger.log(type, message, data);
export const getSyncStats = () => syncDebugger.getStats();
export const displaySyncStats = () => syncDebugger.displayStats();
export const clearSyncLogs = () => syncDebugger.clearLogs();
export const exportSyncLogs = () => syncDebugger.exportLogs();
export const checkSyncFrequency = () => syncDebugger.checkSyncFrequency();

// Make debugging functions available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.syncDebugger = {
    getStats: getSyncStats,
    displayStats: displaySyncStats,
    clearLogs: clearSyncLogs,
    exportLogs: exportSyncLogs,
    checkFrequency: checkSyncFrequency
  };
}

export default syncDebugger;