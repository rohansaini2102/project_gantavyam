import React, { useEffect, useState } from 'react';
import { FiWifi, FiWifiOff, FiUser, FiClock, FiMapPin, FiPhone, FiRefreshCw, FiUsers, FiArrowUp, FiArrowDown, FiList } from 'react-icons/fi';
import { admin as adminAPI } from '../../services/api';
import { initializeSocket, getSocket } from '../../services/socket';
import { getImageUrl } from '../../utils/imageUtils';
import ModernCard from '../../components/admin/ModernCard';

const QueueManagement = () => {
  const [drivers, setDrivers] = useState([]);
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    averageWaitTime: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      window.location.href = '/admin/login';
    } else {
      // Initialize socket for real-time updates
      const initializeSocketAsync = async () => {
        try {
          const socketResult = initializeSocket(token);
          
          // Handle different return types from initializeSocket
          if (socketResult && typeof socketResult.then === 'function') {
            // It's a Promise
            const socket = await socketResult;
            if (socket) {
              console.log('[QueueManagement] Socket initialized successfully (Promise), setting up listeners');
              setupSocketListeners();
            } else {
              console.error('[QueueManagement] Failed to initialize socket (Promise returned null)');
            }
          } else if (socketResult) {
            // It's a direct socket object
            console.log('[QueueManagement] Socket initialized successfully (direct), setting up listeners');
            setupSocketListeners();
          } else {
            console.error('[QueueManagement] Failed to initialize socket (returned null)');
          }
        } catch (error) {
          console.error('[QueueManagement] Error initializing socket:', error);
        }
      };
      
      initializeSocketAsync();
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDrivers, 30000);
    return () => clearInterval(interval);
  }, []);

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) {
      console.error('[QueueManagement] Socket not available for setting up listeners');
      return;
    }

    console.log('[QueueManagement] Setting up socket listeners');
    
    // Verify socket connection status
    if (!socket.connected) {
      console.warn('[QueueManagement] Socket not connected, waiting for connection...');
      socket.on('connect', () => {
        console.log('[QueueManagement] Socket connected, setting up listeners');
        setupActualListeners();
      });
    } else {
      console.log('[QueueManagement] Socket already connected');
      setupActualListeners();
    }

    function setupActualListeners() {
      // Listen for driver status updates
      socket.on('driverStatusUpdated', (data) => {
        console.log('[QueueManagement] Driver status updated:', data);
        updateDriverStatus(data);
      });

      // Listen for driver online/offline events
      socket.on('driverOnline', (data) => {
        console.log('[QueueManagement] Driver went online:', data);
        console.log('[QueueManagement] Queue entry time:', data.queueEntryTime || data.lastActiveTime);
        updateDriverStatus({ ...data, isOnline: true });
      });

      socket.on('driverOffline', (data) => {
        console.log('[QueueManagement] Driver went offline:', data);
        updateDriverStatus({ ...data, isOnline: false });
      });

      // Listen for queue validation results
      socket.on('queueValidationResult', (data) => {
        console.log('[QueueManagement] Queue validation result:', data);
        if (data.success) {
          setSuccess(data.message);
          setTimeout(() => setSuccess(''), 3000);
        }
      });

      socket.on('queueValidationError', (data) => {
        console.log('[QueueManagement] Queue validation error:', data);
        setError(data.error || 'Queue validation failed');
        setTimeout(() => setError(''), 3000);
      });

      // Listen for queue position updates
      socket.on('queuePositionUpdated', (data) => {
        console.log('[QueueManagement] Queue position updated:', data);
        updateQueuePosition(data);
      });

      // Listen for complete queue position updates
      socket.on('queuePositionsUpdated', (data) => {
        console.log('[QueueManagement] Complete queue positions updated:', data);
        if (data.queueUpdates) {
          // Update all drivers with new queue positions
          setDrivers(prevDrivers => {
            const updatedDrivers = prevDrivers.map(driver => {
              const queueUpdate = data.queueUpdates.find(q => q.driverId === driver._id);
              if (queueUpdate) {
                return {
                  ...driver,
                  queuePosition: queueUpdate.queuePosition,
                  isOnline: queueUpdate.isOnline,
                  currentPickupLocation: queueUpdate.currentPickupLocation,
                  lastActiveTime: queueUpdate.lastActiveTime,
                  queueEntryTime: queueUpdate.queueEntryTime || queueUpdate.lastActiveTime
                };
              }
              return driver;
            });
            return updatedDrivers;
          });

          // Update online drivers with new positions, sorted by queue entry time
          setOnlineDrivers(prevOnline => {
            const updatedOnline = data.queueUpdates
              .filter(update => update.isOnline)
              .map(update => ({
                ...update,
                _id: update.driverId,
                fullName: update.driverName,
                queueEntryTime: update.queueEntryTime || update.lastActiveTime
              }))
              .sort((a, b) => {
                // Sort by queue entry time (first-come-first-served)
                if (a.queueEntryTime && b.queueEntryTime) {
                  return new Date(a.queueEntryTime) - new Date(b.queueEntryTime);
                }
                return (a.queuePosition || 999) - (b.queuePosition || 999);
              });
            
            console.log('[QueueManagement] Updated online drivers with new queue positions (sorted by entry time)');
            return updatedOnline;
          });

          // Update stats
          setQueueStats(prevStats => ({
            ...prevStats,
            online: data.totalOnline,
            offline: prevStats.total - data.totalOnline,
            averageWaitTime: data.totalOnline * 5
          }));
        }
      });
      
      console.log('[QueueManagement] All event listeners set up successfully');
    }
  };

  const updateDriverStatus = (data) => {
    setDrivers(prevDrivers => 
      prevDrivers.map(driver => 
        driver._id === data.driverId 
          ? { 
              ...driver, 
              isOnline: data.isOnline, 
              currentPickupLocation: data.currentPickupLocation,
              lastActiveTime: data.lastActiveTime || new Date(),
              queuePosition: data.queuePosition || null,
              queueEntryTime: data.queueEntryTime || (data.isOnline ? new Date() : null)
            }
          : driver
      )
    );
    
    // Update online drivers list
    setOnlineDrivers(prevOnline => {
      if (data.isOnline) {
        const exists = prevOnline.find(d => d._id === data.driverId);
        if (!exists) {
          const driver = drivers.find(d => d._id === data.driverId);
          if (driver) {
            const newOnline = [...prevOnline, {
              ...driver,
              isOnline: true,
              currentPickupLocation: data.currentPickupLocation,
              lastActiveTime: data.lastActiveTime || new Date(),
              queuePosition: data.queuePosition || prevOnline.length + 1,
              queueEntryTime: data.queueEntryTime || new Date()
            }].sort((a, b) => {
              // Sort by queue entry time (first-come-first-served)
              if (a.queueEntryTime && b.queueEntryTime) {
                return new Date(a.queueEntryTime) - new Date(b.queueEntryTime);
              }
              return (a.queuePosition || 999) - (b.queuePosition || 999);
            });
            return newOnline;
          }
        }
        return prevOnline;
      } else {
        return prevOnline.filter(d => d._id !== data.driverId);
      }
    });
  };

  const updateQueuePosition = (data) => {
    setOnlineDrivers(prevOnline => 
      prevOnline.map(driver => 
        driver._id === data.driverId 
          ? { ...driver, queuePosition: data.queuePosition }
          : driver
      ).sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999))
    );
  };

  const fetchDrivers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getAllDrivers();
      const driversData = res.data || [];
      setDrivers(driversData);
      
      // Filter and sort online drivers by queue entry time (first-come-first-served)
      const online = driversData
        .filter(driver => driver.isOnline)
        .sort((a, b) => {
          // First sort by queue entry time (first-come-first-served)
          if (a.queueEntryTime && b.queueEntryTime) {
            return new Date(a.queueEntryTime) - new Date(b.queueEntryTime);
          }
          // If no queue entry time, fall back to last active time
          if (a.lastActiveTime && b.lastActiveTime) {
            return new Date(a.lastActiveTime) - new Date(b.lastActiveTime);
          }
          // Finally, fall back to queue position
          return (a.queuePosition || 999) - (b.queuePosition || 999);
        })
        .map((driver, index) => ({
          ...driver,
          queuePosition: index + 1 // Reassign positions based on sorted order
        }));
      
      setOnlineDrivers(online);
      
      // Debug logging for queue order
      console.log('[QueueManagement] Queue order after fetch:');
      online.forEach((driver, index) => {
        console.log(`  ${index + 1}. ${driver.fullName} - Entry: ${driver.queueEntryTime || driver.lastActiveTime} - Position: ${driver.queuePosition}`);
      });
      
      // Calculate stats
      const now = new Date();
      const totalWaitTimeMs = online.reduce((sum, driver) => {
        const queueEntryTime = driver.queueEntryTime || driver.lastActiveTime;
        if (queueEntryTime) {
          return sum + (now - new Date(queueEntryTime));
        }
        return sum;
      }, 0);
      
      const averageWaitTimeMinutes = online.length > 0 
        ? Math.floor(totalWaitTimeMs / (online.length * 60000)) 
        : 0;
      
      setQueueStats({
        total: driversData.length,
        online: online.length,
        offline: driversData.length - online.length,
        averageWaitTime: averageWaitTimeMinutes
      });
    } catch (err) {
      setError(err.error || 'Failed to fetch drivers');
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
    setSuccess('Queue refreshed successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleValidateQueue = async () => {
    try {
      setLoading(true);
      const socket = getSocket();
      if (socket) {
        socket.emit('validateQueue');
        setSuccess('Queue validation requested - check server logs for results');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error('Socket not connected');
      }
    } catch (err) {
      setError('Failed to validate queue');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const toggleDriverStatus = async (driverId, currentStatus) => {
    try {
      const socket = getSocket();
      if (socket) {
        socket.emit('adminToggleDriverStatus', {
          driverId,
          isOnline: !currentStatus
        });
        setSuccess(currentStatus ? 'Driver set to offline' : 'Driver set to online');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error('Socket not connected');
      }
    } catch (err) {
      setError(err.error || 'Failed to toggle driver status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      return new Date(timeString).toLocaleTimeString();
    } catch {
      return 'N/A';
    }
  };

  const getTimeSince = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const now = new Date();
      const time = new Date(timeString);
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}m ago`;
    } catch {
      return 'N/A';
    }
  };

  const getQueueWaitTime = (queueEntryTime) => {
    if (!queueEntryTime) return 'N/A';
    try {
      const now = new Date();
      const entryTime = new Date(queueEntryTime);
      const diffMs = now - entryTime;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just joined';
      if (diffMins < 60) return `${diffMins}m in queue`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}m in queue`;
    } catch {
      return 'N/A';
    }
  };

  // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('driverStatusUpdated');
        socket.off('driverOnline');
        socket.off('driverOffline');
        socket.off('queuePositionUpdated');
        socket.off('queuePositionsUpdated');
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
          <p className="text-gray-600 mt-1">
            Real-time driver queue monitoring and management
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleValidateQueue}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <FiList className="h-4 w-4" />
            <span>Validate Queue</span>
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-red-800">{error}</span>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ModernCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                <p className="text-2xl font-bold text-gray-900">{queueStats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </ModernCard>
        
        <ModernCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Online</p>
                <p className="text-2xl font-bold text-green-600">{queueStats.online}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FiWifi className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </ModernCard>
        
        <ModernCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Offline</p>
                <p className="text-2xl font-bold text-gray-600">{queueStats.offline}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <FiWifiOff className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </ModernCard>
        
        <ModernCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Queue Wait</p>
                <p className="text-2xl font-bold text-orange-600">{queueStats.averageWaitTime}m</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <FiList className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </ModernCard>
      </div>

      {/* Queue Analytics */}
      <ModernCard>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Queue Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Next in Queue</p>
                  <p className="text-lg font-bold text-blue-900">
                    {onlineDrivers.length > 0 ? onlineDrivers[0]?.fullName || 'Unknown' : 'No drivers'}
                  </p>
                </div>
                <div className="text-blue-600">
                  <FiUser className="h-8 w-8" />
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Queue Efficiency</p>
                  <p className="text-lg font-bold text-green-900">
                    {queueStats.averageWaitTime < 10 ? 'Excellent' : 
                     queueStats.averageWaitTime < 20 ? 'Good' : 'Needs Attention'}
                  </p>
                </div>
                <div className="text-green-600">
                  <FiClock className="h-8 w-8" />
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Longest Wait</p>
                  <p className="text-lg font-bold text-orange-900">
                    {onlineDrivers.length > 0 ? 
                      getQueueWaitTime(onlineDrivers[onlineDrivers.length - 1]?.queueEntryTime) : 
                      'N/A'}
                  </p>
                </div>
                <div className="text-orange-600">
                  <FiArrowUp className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Queue List */}
      <ModernCard>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <FiWifi className="mr-2 text-green-600" />
            Live Queue - Online Drivers ({onlineDrivers.length})
            <span className="ml-3 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
              First Come, First Served
            </span>
          </h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading queue...</p>
            </div>
          ) : onlineDrivers.length === 0 ? (
            <div className="text-center py-12">
              <FiWifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">No drivers online</p>
              <p className="text-gray-500">Drivers will appear here when they go online</p>
            </div>
          ) : (
            <div className="space-y-4">
              {onlineDrivers.map((driver, index) => (
                <div 
                  key={driver._id} 
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                    index === 0 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {/* Queue Position */}
                    <div className="flex-shrink-0">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                        index === 0 
                          ? 'bg-green-600 text-white' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {driver.queuePosition || index + 1}
                      </div>
                    </div>
                    
                    {/* Driver Info */}
                    <div className="flex items-center space-x-3">
                      {driver.driverSelfie ? (
                        <img 
                          src={getImageUrl(driver.driverSelfie)} 
                          alt={driver.fullName} 
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <FiUser className="text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{driver.fullName}</div>
                        <div className="text-xs text-gray-500 flex items-center space-x-3">
                          <span className="flex items-center">
                            <FiPhone className="mr-1" /> {driver.mobileNo}
                          </span>
                          <span className="flex items-center">
                            <FiMapPin className="mr-1" /> {driver.currentPickupLocation || 'No location'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Vehicle Info */}
                    <div className="hidden md:block">
                      <div className="text-sm font-medium text-gray-900">{driver.vehicleNo}</div>
                      <div className="text-xs text-gray-500">{driver.vehicleType || 'N/A'}</div>
                    </div>

                    {/* Queue Entry Time */}
                    <div className="hidden lg:block">
                      <div className="text-sm font-medium text-blue-600">
                        Joined: {formatTime(driver.queueEntryTime || driver.lastActiveTime)}
                      </div>
                      <div className="text-xs text-blue-500">
                        {getQueueWaitTime(driver.queueEntryTime || driver.lastActiveTime)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status and Actions */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        Online: {formatTime(driver.lastActiveTime)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {getTimeSince(driver.lastActiveTime)}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        Queue: {getQueueWaitTime(driver.queueEntryTime || driver.lastActiveTime)}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <FiWifi className="mr-1" /> Online
                      </span>
                      <button
                        onClick={() => toggleDriverStatus(driver._id, driver.isOnline)}
                        className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 rounded transition-colors"
                        title="Set Offline"
                      >
                        Set Offline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModernCard>
    </div>
  );
};

export default QueueManagement;