import React, { useEffect, useState } from 'react';
import { admin as adminAPI } from '../../services/api';
import { FiCheckCircle, FiXCircle, FiUser, FiEye, FiTrash2, FiClock, FiPlus, FiSearch, FiFilter, FiDownload, FiWifi, FiWifiOff } from 'react-icons/fi';
import { getImageUrl } from '../../utils/imageUtils';
import ModernCard from '../../components/admin/ModernCard';
import { useNavigate } from 'react-router-dom';
import { initializeSocket, getSocket } from '../../services/socket';

const statusColors = {
  approved: 'text-green-600',
  pending: 'text-yellow-500',
  rejected: 'text-red-500',
};

const AllDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
              console.log('[AllDrivers] Socket initialized successfully (Promise), setting up listeners');
              setupSocketListeners();
            } else {
              console.error('[AllDrivers] Failed to initialize socket (Promise returned null)');
            }
          } else if (socketResult) {
            // It's a direct socket object
            console.log('[AllDrivers] Socket initialized successfully (direct), setting up listeners');
            setupSocketListeners();
          } else {
            console.error('[AllDrivers] Failed to initialize socket (returned null)');
          }
        } catch (error) {
          console.error('[AllDrivers] Error initializing socket:', error);
        }
      };
      
      initializeSocketAsync();
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) {
      console.error('[AllDrivers] Socket not available for setting up listeners');
      return;
    }

    console.log('[AllDrivers] Setting up socket listeners');
    
    // Verify socket connection status
    if (!socket.connected) {
      console.warn('[AllDrivers] Socket not connected, waiting for connection...');
      socket.on('connect', () => {
        console.log('[AllDrivers] Socket connected, admin should be in admins room');
        setupActualListeners();
      });
    } else {
      console.log('[AllDrivers] Socket already connected');
      setupActualListeners();
    }

    function setupActualListeners() {
      console.log('[AllDrivers] Setting up actual event listeners');
      
      // Listen for driver status updates
      socket.on('driverStatusUpdated', (data) => {
        console.log('[AllDrivers] Received driverStatusUpdated event:', data);
        setDrivers(prevDrivers => {
          const updatedDrivers = prevDrivers.map(driver => 
            driver._id === data.driverId 
              ? { 
                  ...driver, 
                  isOnline: data.isOnline, 
                  currentPickupLocation: data.currentPickupLocation, 
                  lastActiveTime: data.lastActiveTime 
                }
              : driver
          );
          console.log('[AllDrivers] Updated drivers list');
          return updatedDrivers;
        });
      });

      // Listen for admin toggle confirmations
      socket.on('adminToggleDriverStatusConfirmed', (data) => {
        console.log('[AllDrivers] Admin toggle confirmed:', data);
        setSuccess(data.message);
        setActionLoading(null);
        setTimeout(() => setSuccess(''), 3000);
      });

      // Listen for admin toggle errors
      socket.on('adminToggleDriverStatusError', (data) => {
        console.log('[AllDrivers] Admin toggle error:', data);
        setError(data.error);
        setActionLoading(null);
        setTimeout(() => setError(''), 3000);
      });

      // Listen for queue position updates
      socket.on('queuePositionsUpdated', (data) => {
        console.log('[AllDrivers] Queue positions updated:', data);
        // Update drivers with new queue positions
        if (data.queueUpdates) {
          setDrivers(prevDrivers => {
            const updatedDrivers = prevDrivers.map(driver => {
              const queueUpdate = data.queueUpdates.find(q => q.driverId === driver._id);
              if (queueUpdate) {
                return {
                  ...driver,
                  queuePosition: queueUpdate.queuePosition,
                  isOnline: queueUpdate.isOnline
                };
              }
              return driver;
            });
            console.log('[AllDrivers] Updated drivers with new queue positions');
            return updatedDrivers;
          });
        }
      });

      console.log('[AllDrivers] All event listeners set up successfully');
    }
  };

  // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      const socket = getSocket();
      if (socket) {
        console.log('[AllDrivers] Cleaning up socket listeners');
        socket.off('driverStatusUpdated');
        socket.off('adminToggleDriverStatusConfirmed');
        socket.off('adminToggleDriverStatusError');
        socket.off('queuePositionsUpdated');
        socket.off('connect');
      }
    };
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getAllDrivers();
      const driversData = res.data || [];
      setDrivers(driversData);
    } catch (err) {
      setError(err.error || 'Failed to fetch drivers');
    }
    setLoading(false);
  };

  const toggleDriverStatus = async (driverId, currentStatus) => {
    console.log(`[AllDrivers] Toggling driver ${driverId} from ${currentStatus ? 'online' : 'offline'} to ${!currentStatus ? 'online' : 'offline'}`);
    
    setActionLoading(driverId + '-toggle');
    setError('');
    setSuccess('');
    
    try {
      const socket = getSocket();
      if (!socket) {
        throw new Error('Socket not connected');
      }
      
      if (!socket.connected) {
        throw new Error('Socket not connected to server');
      }
      
      console.log('[AllDrivers] Emitting adminToggleDriverStatus event');
      
      // Emit admin driver status change
      socket.emit('adminToggleDriverStatus', {
        driverId,
        isOnline: !currentStatus
      });
      
      console.log('[AllDrivers] Toggle request sent to server');
      
    } catch (err) {
      console.error('[AllDrivers] Error in toggleDriverStatus:', err);
      setError(err.message || 'Failed to toggle driver status');
      setActionLoading(null);
    }
    
    // Note: Don't set actionLoading to null here - let the confirmation/error handlers do it
  };

  const handleApprove = async (id) => {
    setActionLoading(id + '-approve');
    setError('');
    setSuccess('');
    try {
      await adminAPI.verifyDriver(id, true);
      setSuccess('Driver approved successfully');
      fetchDrivers();
    } catch (err) {
      setError(err.error || 'Failed to approve driver');
    }
    setActionLoading(null);
  };

  const handleReject = async (id) => {
    setActionLoading(id + '-reject');
    setError('');
    setSuccess('');
    try {
      await adminAPI.verifyDriver(id, false);
      setSuccess('Driver rejected');
      fetchDrivers();
    } catch (err) {
      setError(err.error || 'Failed to reject driver');
    }
    setActionLoading(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this driver?')) return;
    setActionLoading(id + '-delete');
    setError('');
    setSuccess('');
    try {
      await adminAPI.deleteDriver(id);
      setSuccess('Driver removed');
      fetchDrivers();
    } catch (err) {
      setError(err.error || 'Failed to remove driver');
    }
    setActionLoading(null);
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchesTab = tab === 'all' || (tab === 'pending' && !d.isVerified) || (tab === 'approved' && d.isVerified);
    const matchesSearch = searchTerm === '' || 
      d.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.mobileNo.includes(searchTerm) ||
      d.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Drivers</h1>
          <p className="text-gray-600 mt-1">
            {loading ? 'Loading...' : `${filteredDrivers.length} ${filteredDrivers.length === 1 ? 'driver' : 'drivers'} found`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin/register-driver')}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add Driver</span>
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

      {/* Tabs and Search */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button 
            onClick={() => setTab('all')} 
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({drivers.length})
          </button>
          <button 
            onClick={() => setTab('pending')} 
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === 'pending' 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({drivers.filter(d => !d.isVerified).length})
          </button>
          <button 
            onClick={() => setTab('approved')} 
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === 'approved' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active ({drivers.filter(d => d.isVerified).length})
          </button>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search drivers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
      </div>

      {/* Drivers Table */}
      <ModernCard>
        <div className="table-responsive">
          <table className="table-desktop min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Online Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading drivers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FiUser className="h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-lg font-medium text-gray-900">No drivers found</p>
                        <p className="text-gray-500">
                          {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first driver'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredDrivers.map(driver => (
                <tr key={driver._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {driver.driverSelfie ? (
                      <img 
                        src={getImageUrl(driver.driverSelfie)} 
                        alt={driver.fullName} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 cursor-pointer"
                        onClick={() => { setSelectedDriver(driver); setShowDetails(true); }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <FiUser className="text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{driver.fullName}</div>
                    <div className="text-sm text-gray-500">ID: {driver._id.slice(-8)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{driver.mobileNo}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{driver.vehicleNo}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {driver.isVerified ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <FiCheckCircle className="mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <FiClock className="mr-1" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {driver.isOnline ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiWifi className="mr-1" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <FiWifiOff className="mr-1" /> Offline
                        </span>
                      )}
                      {driver.isVerified && (
                        <button
                          disabled={actionLoading === driver._id + '-toggle'}
                          onClick={() => toggleDriverStatus(driver._id, driver.isOnline)}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                            driver.isOnline
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                          title={driver.isOnline ? 'Set Offline' : 'Set Online'}
                        >
                          {actionLoading === driver._id + '-toggle' ? '...' : (driver.isOnline ? 'Set Offline' : 'Set Online')}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {driver.registrationDate ? new Date(driver.registrationDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-900 transition-colors" 
                        title="View Details" 
                        onClick={() => { setSelectedDriver(driver); setShowDetails(true); }}
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                      {!driver.isVerified && (
                        <>
                          <button 
                            disabled={actionLoading === driver._id + '-approve'} 
                            onClick={() => handleApprove(driver._id)} 
                            className="text-green-600 hover:text-green-900 transition-colors disabled:opacity-50" 
                            title="Approve"
                          >
                            <FiCheckCircle className="h-4 w-4" />
                          </button>
                          <button 
                            disabled={actionLoading === driver._id + '-reject'} 
                            onClick={() => handleReject(driver._id)} 
                            className="text-orange-600 hover:text-orange-900 transition-colors disabled:opacity-50" 
                            title="Reject"
                          >
                            <FiXCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {driver.isVerified && (
                        <button 
                          disabled={actionLoading === driver._id + '-delete'} 
                          onClick={() => handleDelete(driver._id)} 
                          className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50" 
                          title="Remove"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Mobile Card Layout */}
          <div className="table-mobile">
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center space-x-2 py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-gray-500">Loading drivers...</span>
                </div>
              ) : filteredDrivers.length === 0 ? (
                <div className="flex flex-col items-center space-y-3 py-12">
                  <FiUser className="h-12 w-12 text-gray-400" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">No drivers found</p>
                    <p className="text-gray-500">
                      {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first driver'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredDrivers.map(driver => (
                  <div key={driver._id} className="table-card">
                    <div className="table-card-header">
                      <div className="flex items-center space-x-3">
                        {driver.driverSelfie ? (
                          <img 
                            src={getImageUrl(driver.driverSelfie)} 
                            alt={driver.fullName} 
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 cursor-pointer"
                            onClick={() => { setSelectedDriver(driver); setShowDetails(true); }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <FiUser className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="table-card-title">{driver.fullName}</div>
                          <div className="table-card-subtitle">ID: {driver._id.slice(-8)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {driver.isVerified ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <FiCheckCircle className="mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <FiClock className="mr-1" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="table-card-body">
                      <div className="table-card-row">
                        <span className="table-card-label">Contact</span>
                        <span className="table-card-value">{driver.mobileNo}</span>
                      </div>
                      
                      <div className="table-card-row">
                        <span className="table-card-label">Vehicle</span>
                        <span className="table-card-value">{driver.vehicleNo}</span>
                      </div>
                      
                      <div className="table-card-row">
                        <span className="table-card-label">Registered</span>
                        <span className="table-card-value text-xs">
                          {driver.registrationDate ? new Date(driver.registrationDate).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="table-card-actions">
                      <button 
                        className="table-card-action-btn bg-blue-600 text-white hover:bg-blue-700" 
                        onClick={() => { setSelectedDriver(driver); setShowDetails(true); }}
                      >
                        <FiEye className="inline mr-2" />
                        View Details
                      </button>
                      {!driver.isVerified && (
                        <>
                          <button 
                            disabled={actionLoading === driver._id + '-approve'} 
                            onClick={() => handleApprove(driver._id)} 
                            className="table-card-action-btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <FiCheckCircle className="inline mr-2" />
                            Approve
                          </button>
                          <button 
                            disabled={actionLoading === driver._id + '-reject'} 
                            onClick={() => handleReject(driver._id)} 
                            className="table-card-action-btn bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            <FiXCircle className="inline mr-2" />
                            Reject
                          </button>
                        </>
                      )}
                      {driver.isVerified && (
                        <button 
                          disabled={actionLoading === driver._id + '-delete'} 
                          onClick={() => handleDelete(driver._id)} 
                          className="table-card-action-btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <FiTrash2 className="inline mr-2" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </ModernCard>
      {showDetails && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-black text-2xl" onClick={() => setShowDetails(false)}>&times;</button>
            <h2 className="text-2xl font-bold text-blue-700 mb-4 flex items-center gap-2"><FiUser /> Driver Details</h2>
            
            {/* Driver Live Photo */}
            {selectedDriver.driverSelfie && (
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <img 
                    src={getImageUrl(selectedDriver.driverSelfie)} 
                    alt={selectedDriver.fullName} 
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-200 shadow-lg"
                  />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Live Photo
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <p><span className="font-semibold">Name:</span> {selectedDriver.fullName}</p>
                <p><span className="font-semibold">Phone:</span> {selectedDriver.mobileNo}</p>
                <p><span className="font-semibold">Aadhaar No:</span> {selectedDriver.aadhaarNo}</p>
                <p><span className="font-semibold">Vehicle No:</span> {selectedDriver.vehicleNo}</p>
                <p><span className="font-semibold">Status:</span> {selectedDriver.isVerified ? 'Active' : 'Pending Approval'}</p>
                <p><span className="font-semibold">Registered:</span> {selectedDriver.registrationDate ? new Date(selectedDriver.registrationDate).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Bank Details</h3>
                <p><span className="font-semibold">Account Holder:</span> {selectedDriver.bankDetails?.accountHolderName}</p>
                <p><span className="font-semibold">Account Number:</span> {selectedDriver.bankDetails?.accountNumber}</p>
                <p><span className="font-semibold">IFSC Code:</span> {selectedDriver.bankDetails?.ifscCode}</p>
                <p><span className="font-semibold">Bank Name:</span> {selectedDriver.bankDetails?.bankName}</p>
              </div>
            </div>
            <h3 className="font-semibold mb-2">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Backward compatibility for old aadhaarPhoto field */}
              {selectedDriver.aadhaarPhoto && !selectedDriver.aadhaarPhotoFront && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Aadhaar Photo:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.aadhaarPhoto)}
                      alt="Aadhaar"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.aadhaarPhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.aadhaarPhotoFront && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Aadhaar Photo (Front):</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.aadhaarPhotoFront)}
                      alt="Aadhaar Front"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.aadhaarPhotoFront)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.aadhaarPhotoBack && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Aadhaar Photo (Back):</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.aadhaarPhotoBack)}
                      alt="Aadhaar Back"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.aadhaarPhotoBack)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.driverSelfie && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Live Photo (Selfie):</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.driverSelfie)}
                      alt="Driver Selfie"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.driverSelfie)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.registrationCertificatePhoto && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Registration Certificate:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.registrationCertificatePhoto)}
                      alt="RC"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.registrationCertificatePhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.drivingLicensePhoto && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Driving License:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.drivingLicensePhoto)}
                      alt="DL"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.drivingLicensePhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.permitPhoto && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Permit:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.permitPhoto)}
                      alt="Permit"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.permitPhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.fitnessCertificatePhoto && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Fitness Certificate:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.fitnessCertificatePhoto)}
                      alt="Fitness"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.fitnessCertificatePhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
              {selectedDriver.insurancePolicyPhoto && (
                <div className="flex flex-col items-start max-w-full">
                  <span className="font-semibold">Insurance Policy:</span>
                  <div className="relative w-full">
                    <img
                      src={getImageUrl(selectedDriver.insurancePolicyPhoto)}
                      alt="Insurance"
                      className="max-w-full max-h-40 border rounded mt-1 object-contain bg-gray-50"
                      style={{ width: '100%', height: '160px' }}
                    />
                    <a
                      href={getImageUrl(selectedDriver.insurancePolicyPhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs underline mt-1 inline-block"
                    >Open in new window</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllDrivers; 