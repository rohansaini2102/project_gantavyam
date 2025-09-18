import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaHome, 
  FaCar, 
  FaUser, 
  FaSignOutAlt,
  FaHistory,
  FaDollarSign
} from 'react-icons/fa';

// Import minimal components
import MinimalStatusToggle from './MinimalStatusToggle';
import MinimalRideCard from './MinimalRideCard';
import MinimalActiveRide from './MinimalActiveRide';

// Import services and hooks
import { 
  initializeSocket, 
  subscribeToDriverUpdates, 
  unsubscribeFromDriverUpdates,
  isSocketConnected 
} from '../../../services/socket';
import { useDriverState } from '../../../contexts/DriverStateContext';

// Import styles
import '../styles/MinimalTheme.css';

const MinimalDriverDashboard = () => {
  const navigate = useNavigate();
  
  // State from context
  const {
    driver,
    socket,
    socketConnected,
    isOnline,
    queuePosition,
    activeRide,
    rideRequests,
    actions
  } = useDriverState();

  // Local state
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [rideStage, setRideStage] = useState('assigned');
  const [assignedRides, setAssignedRides] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [tripsToday, setTripsToday] = useState(0);

  // Helper function to get driver's earnings (base fare only, no GST/commission)
  const getDriverEarnings = (ride) => {
    // Priority 1: Use driverFare field (most accurate - what driver actually earns)
    if (ride.driverFare && ride.driverFare > 0) {
      return ride.driverFare;
    }

    // TEMPORARY FALLBACK: For existing ride requests without driverFare field
    // This handles the transition period until all new requests have driverFare
    if (ride.fare && ride.fare > 0) {
      console.warn(`[MinimalDriverDashboard] Using fallback fare for ride ${ride._id} - driverFare missing`);
      return ride.fare;
    }

    if (ride.estimatedFare && ride.estimatedFare > 0) {
      console.warn(`[MinimalDriverDashboard] Using fallback estimatedFare for ride ${ride._id} - driverFare missing`);
      return ride.estimatedFare;
    }

    // Log warning if no fare data available
    if (ride && ride._id) {
      console.warn(`[MinimalDriverDashboard] No fare data available for ride ${ride._id}:`, {
        rideId: ride._id,
        driverFare: ride.driverFare,
        fare: ride.fare,
        estimatedFare: ride.estimatedFare,
        status: ride.status
      });
    }

    return 0;
  };;

  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      const token = localStorage.getItem('driverToken');
      if (token && !socket) {
        try {
          const socketInstance = await initializeSocket(token);
          actions.setSocket(socketInstance);
          actions.setSocketConnected(true);
        } catch (error) {
          console.error('Socket initialization error:', error);
          actions.setSocketConnected(false);
        }
      }
    };

    initSocket();
  }, []);

  // Subscribe to driver updates
  useEffect(() => {
    if (socket && socketConnected) {
      const callbacks = {
        onNewRideRequest: (data) => {
          console.log('New ride request:', data);
          actions.addRideRequest(data);
        },
        onRideAssigned: (data) => {
          console.log('Ride assigned:', data);
          setAssignedRides(prev => [...prev, data]);
        },
        onRideAcceptConfirmed: (data) => {
          console.log('Ride accepted:', data);
          actions.setActiveRide(data.ride);
          setRideStage('assigned');
        },
        onRideStarted: (data) => {
          console.log('Ride started:', data);
          setRideStage('started');
        },
        onRideCompleted: (data) => {
          console.log('Ride completed:', data);
          actions.setActiveRide(null);
          setRideStage('assigned');
          setTripsToday(prev => prev + 1);
          setEarnings(prev => prev + getDriverEarnings(data));
        },
        onDriverOnlineConfirmed: (data) => {
          console.log('Driver online confirmed:', data);
          actions.setIsOnline(true);
          actions.setQueuePosition(data.queuePosition);
        },
        onDriverOfflineConfirmed: () => {
          console.log('Driver offline confirmed');
          actions.setIsOnline(false);
          actions.setQueuePosition(null);
        },
        onQueuePositionUpdated: (data) => {
          console.log('Queue position updated:', data);
          actions.setQueuePosition(data.queuePosition);
        }
      };

      subscribeToDriverUpdates(callbacks);

      return () => {
        unsubscribeFromDriverUpdates();
      };
    }
  }, [socket, socketConnected]);

  // Toggle online status
  const toggleOnlineStatus = async () => {
    if (!socketConnected) {
      alert('Connection required to change status');
      return;
    }

    setIsLoading(true);
    try {
      if (!isOnline) {
        await actions.goOnline();
      } else {
        await actions.goOffline();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to change status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Accept ride
  const acceptRide = async (ride) => {
    if (!socketConnected) {
      alert('Connection required');
      return;
    }

    try {
      await actions.acceptRide(ride);
      // Remove from requests
      actions.removeRideRequest(ride._id || ride.id);
      // Remove from assigned rides if it was there
      setAssignedRides(prev => prev.filter(r => r._id !== ride._id));
    } catch (error) {
      console.error('Error accepting ride:', error);
      alert('Failed to accept ride');
    }
  };

  // Reject ride
  const rejectRide = async (ride) => {
    if (!socketConnected) {
      alert('Connection required');
      return;
    }

    try {
      await actions.rejectRide(ride);
      // Remove from requests or assigned rides
      actions.removeRideRequest(ride._id || ride.id);
      setAssignedRides(prev => prev.filter(r => r._id !== ride._id));
    } catch (error) {
      console.error('Error rejecting ride:', error);
      alert('Failed to reject ride');
    }
  };

  // Start ride
  const startRide = async () => {
    setRideStage('started');
    // Additional logic if needed
  };

  // Complete ride
  const completeRide = async () => {
    actions.setActiveRide(null);
    setRideStage('assigned');
    // Additional logic if needed
  };

  // Verify OTP
  const verifyOTP = async (otp, type) => {
    try {
      if (type === 'start') {
        await actions.verifyStartOTP(activeRide._id, otp);
        setRideStage('started');
      } else {
        await actions.verifyEndOTP(activeRide._id, otp);
        completeRide();
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      alert('Invalid OTP. Please try again.');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driverInfo');
    navigate('/driver/login');
  };

  // Get all rides to display
  const getAllRides = () => {
    const allRides = [...rideRequests, ...assignedRides];
    // Remove duplicates based on _id
    const uniqueRides = allRides.filter((ride, index, self) =>
      index === self.findIndex((r) => r._id === ride._id)
    );
    return uniqueRides;
  };

  return (
    <div className="minimal-driver-container">
      {/* Header */}
      <div className="minimal-header">
        <div className="minimal-header-title">
          Driver
        </div>
        <div className="flex items-center gap-3">
          <div className={`minimal-connection-indicator ${!socketConnected ? 'disconnected' : ''}`} />
          <button onClick={handleLogout} className="text-gray-600">
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="minimal-mobile-container">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-4">
            {/* Status Toggle */}
            <MinimalStatusToggle
              isOnline={isOnline}
              isLoading={isLoading}
              onToggle={toggleOnlineStatus}
              queuePosition={queuePosition}
              socketConnected={socketConnected}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 px-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <FaDollarSign className="text-blue-500 text-2xl mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">₹{earnings}</div>
                <div className="text-xs text-blue-600">Today's Earnings</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <FaCar className="text-gray-500 text-2xl mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{tripsToday}</div>
                <div className="text-xs text-gray-600">Trips Today</div>
              </div>
            </div>

            {/* Active Ride or Ride Requests */}
            {activeRide ? (
              <div className="px-4">
                <h3 className="text-lg font-semibold mb-3">Active Ride</h3>
                <MinimalActiveRide
                  ride={activeRide}
                  stage={rideStage}
                  onStartRide={startRide}
                  onCompleteRide={completeRide}
                  onVerifyOTP={verifyOTP}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="px-4">
                <h3 className="text-lg font-semibold mb-3">
                  {getAllRides().length > 0 ? 'Available Rides' : 'No Rides'}
                </h3>
                
                {getAllRides().length > 0 ? (
                  <div className="space-y-3">
                    {getAllRides().map((ride) => (
                      <MinimalRideCard
                        key={ride._id || ride.id}
                        ride={ride}
                        onAccept={acceptRide}
                        onReject={rejectRide}
                        isAccepting={isLoading}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="minimal-empty-state">
                    <div className="minimal-empty-icon">🚗</div>
                    <div className="minimal-empty-text">
                      {isOnline 
                        ? 'Waiting for ride requests...' 
                        : 'Go online to receive rides'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rides View */}
        {currentView === 'rides' && (
          <div className="px-4">
            <h3 className="text-lg font-semibold mb-4">My Rides</h3>
            
            {activeRide ? (
              <MinimalActiveRide
                ride={activeRide}
                stage={rideStage}
                onStartRide={startRide}
                onCompleteRide={completeRide}
                onVerifyOTP={verifyOTP}
                isLoading={isLoading}
              />
            ) : (
              <div className="space-y-3">
                {getAllRides().length > 0 ? (
                  getAllRides().map((ride) => (
                    <MinimalRideCard
                      key={ride._id || ride.id}
                      ride={ride}
                      onAccept={acceptRide}
                      onReject={rejectRide}
                      isAccepting={isLoading}
                    />
                  ))
                ) : (
                  <div className="minimal-empty-state">
                    <div className="minimal-empty-icon">📋</div>
                    <div className="minimal-empty-text">No rides available</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Profile View */}
        {currentView === 'profile' && (
          <div className="px-4">
            <h3 className="text-lg font-semibold mb-4">Profile</h3>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <FaUser className="text-blue-500 text-2xl" />
                </div>
                <div>
                  <div className="font-semibold text-lg">
                    {driver?.fullName || 'Driver'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {driver?.mobileNo || 'Phone number'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle</span>
                  <span className="font-medium">{driver?.vehicleType || 'Auto'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Queue Position</span>
                  <span className="font-medium">
                    {queuePosition || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <FaSignOutAlt />
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="minimal-bottom-nav">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`minimal-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
        >
          <FaHome className="minimal-nav-icon" />
          <span className="minimal-nav-label">Home</span>
        </button>
        
        <button
          onClick={() => setCurrentView('rides')}
          className={`minimal-nav-item ${currentView === 'rides' ? 'active' : ''}`}
        >
          <FaCar className="minimal-nav-icon" />
          <span className="minimal-nav-label">Rides</span>
          {getAllRides().length > 0 && !activeRide && (
            <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </button>
        
        <button
          onClick={() => setCurrentView('profile')}
          className={`minimal-nav-item ${currentView === 'profile' ? 'active' : ''}`}
        >
          <FaUser className="minimal-nav-icon" />
          <span className="minimal-nav-label">Profile</span>
        </button>
      </div>
    </div>
  );
};

export default MinimalDriverDashboard;