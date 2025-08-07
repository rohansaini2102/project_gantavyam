import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaMapMarkerAlt, 
  FaUser, 
  FaPhone, 
  FaPowerOff,
  FaWifi,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaWallet,
  FaCar,
  FaCheckCircle,
  FaHistory,
  FaChevronDown,
  FaChevronUp,
  FaClock,
  FaRoute,
  FaTimes
} from 'react-icons/fa';

// Import services and hooks
import { 
  initializeSocket, 
  subscribeToDriverUpdates, 
  unsubscribeFromDriverUpdates,
  driverGoOnline,
  driverGoOffline,
  driverAcceptRide,
  verifyStartOTP,
  verifyEndOTP,
  cancelRide
} from '../../../services/socket';
import { useDriverState } from '../../../contexts/DriverStateContext';
import { drivers } from '../../../services/api';

const ModernDriverDashboard = () => {
  console.log('🚀 ModernDriverDashboard Component Loaded - New UI Active!');
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
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [selectedRide, setSelectedRide] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Ride history state
  const [rideHistory, setRideHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [completedRideDetails, setCompletedRideDetails] = useState(null);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // Load driver data on mount
  useEffect(() => {
    const driverData = localStorage.getItem('driver');
    if (driverData && !driver) {
      try {
        const parsedDriver = JSON.parse(driverData);
        console.log('[ModernDriverDashboard] Loading driver data:', parsedDriver);
        actions.setDriver(parsedDriver);
      } catch (error) {
        console.error('[ModernDriverDashboard] Error parsing driver data:', error);
      }
    }
  }, []);

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
          console.log('[ModernDriverDashboard] New ride request:', data);
          
          // All bookings (including manual) now require driver acceptance
          // No skipping - handle all ride requests the same way
          
          // Create ride object similar to SimplifiedDashboard
          const newRide = {
            _id: data._id || data.rideId,
            rideId: data.rideId,
            bookingId: data.bookingId,
            userName: data.userName,
            userPhone: data.userPhone,
            pickupLocation: data.pickupLocation,
            dropLocation: data.dropLocation,
            vehicleType: data.vehicleType,
            distance: data.distance,
            fare: data.estimatedFare,
            estimatedFare: data.estimatedFare,
            startOTP: data.startOTP,
            endOTP: data.endOTP || null,
            status: 'pending',
            isManualBooking: data.isManualBooking || false,
            bookingSource: data.bookingSource || 'online'
          };
          
          setAssignedRides(prev => [newRide, ...prev]);
          
          // Show notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚕 New Ride Request!', {
              body: `${data.userName || 'Customer'} - ₹${data.estimatedFare}`,
              icon: '/favicon.ico'
            });
          }
        },
        onRideAssigned: (data) => {
          console.log('[ModernDriverDashboard] Ride assigned by admin:', data);
          
          const assignedRide = {
            _id: data.rideId,
            rideId: data.bookingId || data.rideId,
            bookingId: data.bookingId,
            userName: data.user?.name || data.userName,
            userPhone: data.user?.phone || data.userPhone,
            pickupLocation: {
              boothName: data.pickupLocation,
              latitude: 0,
              longitude: 0
            },
            dropLocation: {
              address: data.dropLocation,
              latitude: 0,
              longitude: 0
            },
            vehicleType: data.vehicleType,
            fare: data.estimatedFare,
            estimatedFare: data.estimatedFare,
            startOTP: data.startOTP,
            endOTP: data.endOTP,
            status: 'assigned',
            autoAssigned: true
          };
          
          setAssignedRides(prev => [assignedRide, ...prev]);
        },
        // Manual ride assignment handler removed - manual bookings now use newRideRequest
        // onManualRideAssigned handler was here but removed for unified flow
        onRideAcceptConfirmed: (data) => {
          console.log('[ModernDriverDashboard] Ride accept confirmed:', data);
          console.log('[ModernDriverDashboard] Ride OTPs:', { 
            startOTP: data.startOTP, 
            endOTP: data.endOTP 
          });
          
          // Find the ride from current state or use data.ride
          setAssignedRides(prev => {
            const acceptedRide = prev.find(r => r._id === data.rideId) || data.ride;
            
            if (acceptedRide) {
              // Set as active ride with all OTP data
              const activeRideData = {
                ...acceptedRide,
                _id: data.rideId || acceptedRide._id,
                status: 'accepted',
                queueNumber: data.queueNumber,
                queuePosition: data.queuePosition,
                acceptedAt: data.acceptedAt,
                // Ensure OTPs are included from the acceptance data
                startOTP: data.startOTP || acceptedRide.startOTP,
                endOTP: data.endOTP || acceptedRide.endOTP
              };
              
              console.log('[ModernDriverDashboard] Setting active ride with OTPs:', {
                id: activeRideData._id,
                startOTP: activeRideData.startOTP,
                endOTP: activeRideData.endOTP
              });
              actions.setActiveRide(activeRideData);
              setRideStage('assigned');
              
              // Remove from assigned rides list
              return prev.filter(r => r._id !== data.rideId);
            }
            
            return prev;
          });
        },
        onRideStarted: (data) => {
          console.log('[ModernDriverDashboard] Ride started:', data);
          console.log('[ModernDriverDashboard] End OTP received:', data.endOTP);
          setRideStage('started');
          
          // Update active ride with endOTP
          actions.setActiveRide(prev => {
            const updatedRide = {
              ...prev,
              status: 'ride_started',
              endOTP: data.endOTP || prev?.endOTP // Ensure endOTP is set when ride starts
            };
            console.log('[ModernDriverDashboard] Updated active ride with endOTP:', {
              id: updatedRide._id,
              endOTP: updatedRide.endOTP,
              hasEndOTP: !!updatedRide.endOTP
            });
            return updatedRide;
          });
        },
        onRideCompleted: (data) => {
          console.log('[ModernDriverDashboard] Ride completed:', data);
          
          // Store completed ride details for animation
          const completedRide = {
            ...activeRide,
            fare: data.fare || data.actualFare || activeRide.estimatedFare,
            completedAt: new Date(),
            status: 'completed'
          };
          setCompletedRideDetails(completedRide);
          
          // Show completion animation
          setShowCompletionAnimation(true);
          
          // Update stats with animation
          setTripsToday(prev => prev + 1);
          setEarnings(prev => prev + (data.fare || data.actualFare || 0));
          
          // Fetch updated ride history
          fetchRideHistory();
          
          // Clear active ride and animation after delay
          setTimeout(() => {
            actions.setActiveRide(null);
            setRideStage('assigned');
            setShowCompletionAnimation(false);
            setCompletedRideDetails(null);
          }, 4000);
        },
        onDriverOnlineConfirmed: (data) => {
          console.log('Driver online confirmed:', data);
          actions.setOnlineStatus(true);
          actions.setQueuePosition(data.queuePosition);
        },
        onDriverOfflineConfirmed: () => {
          console.log('Driver offline confirmed');
          actions.setOnlineStatus(false);
          actions.setQueuePosition(null);
          setAssignedRides([]);
          actions.setActiveRide(null);
        },
        onQueuePositionUpdated: (data) => {
          console.log('Queue position updated:', data);
          actions.setQueuePosition(data.queuePosition);
        },
        onRideAcceptError: (data) => {
          console.log('[ModernDriverDashboard] Ride accept error:', data);
          alert(data.message || 'Failed to accept ride');
        },
        onRideCancelled: (data) => {
          console.log('[ModernDriverDashboard] Ride cancelled:', data);
          actions.setActiveRide(null);
          setRideStage('assigned');
          setAssignedRides(prev => prev.filter(r => r._id !== data.rideId));
        },
        onOTPVerificationSuccess: (data) => {
          console.log('[ModernDriverDashboard] OTP verification success:', data);
          setShowOTPInput(false);
          setOtpInput('');
        },
        onOTPVerificationError: (data) => {
          console.log('[ModernDriverDashboard] OTP verification error:', data);
          alert(data.message || 'Invalid OTP');
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
    if (!socketConnected) return;

    setIsLoading(true);
    try {
      if (!isOnline) {
        // Going online
        console.log('[ModernDriverDashboard] Going online...');
        driverGoOnline({
          vehicleType: driver?.vehicleType || 'auto',
          location: { lat: 28.6139, lng: 77.2090 } // Default Delhi location
        });
        actions.setOnlineStatus(true);
      } else {
        // Going offline
        console.log('[ModernDriverDashboard] Going offline...');
        driverGoOffline();
        actions.setOnlineStatus(false);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Accept ride
  const acceptRide = async (ride) => {
    if (!socketConnected || !driver) {
      alert('Connection required to accept ride');
      return;
    }

    try {
      const acceptData = {
        rideId: ride._id,
        driverId: driver._id || driver.id,
        driverName: driver.fullName || driver.name,
        driverPhone: driver.phone || driver.mobileNo,
        vehicleDetails: {
          type: driver?.vehicleType || 'auto',
          number: driver.vehicleNumber || driver.vehicleNo
        },
        currentLocation: { lat: 28.6139, lng: 77.2090 }
      };
      
      console.log('[ModernDriverDashboard] Accepting ride:', acceptData);
      
      // Call with callback to handle response
      driverAcceptRide(acceptData, (response) => {
        console.log('[ModernDriverDashboard] Accept response:', response);
        if (response && response.success) {
          // Don't remove here, wait for onRideAcceptConfirmed event
          console.log('[ModernDriverDashboard] Ride accepted successfully');
        } else {
          alert(response?.message || 'Failed to accept ride');
        }
      });
      
      setSelectedRide(null);
      setShowBottomSheet(false);
    } catch (error) {
      console.error('Error accepting ride:', error);
      alert('Error accepting ride. Please try again.');
    }
  };

  // Reject ride
  const rejectRide = async (ride) => {
    if (!socketConnected || !driver) return;

    try {
      if (socket) {
        const rejectData = {
          rideId: ride._id,
          driverId: driver._id || driver.id,
          reason: 'Driver not available'
        };
        
        socket.emit('driverRejectRide', rejectData, (response) => {
          console.log('[ModernDriverDashboard] Reject response:', response);
          if (response && response.success) {
            actions.removeRideRequest(ride._id || ride.id);
            setAssignedRides(prev => prev.filter(r => r._id !== ride._id));
          }
        });
      }
      
      setSelectedRide(null);
      setShowBottomSheet(false);
    } catch (error) {
      console.error('Error rejecting ride:', error);
    }
  };

  // Cancel active ride
  const handleCancelRide = async () => {
    if (!activeRide || !socketConnected || !driver) {
      console.log('[ModernDriverDashboard] Cannot cancel ride - missing requirements');
      return;
    }

    // Show confirmation dialog
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel this ride?

` +
      `Customer: ${activeRide.userName || 'Customer'}
` +
      `Fare: ₹${activeRide.estimatedFare || activeRide.fare}

` +
      `Note: Cancelling rides may affect your rating.`
    );

    if (!confirmCancel) {
      console.log('[ModernDriverDashboard] Ride cancellation aborted by user');
      return;
    }

    try {
      const cancelData = {
        rideId: activeRide._id || activeRide.rideId,
        driverId: driver._id || driver.id,
        reason: rideStage === 'started' 
          ? 'Driver cancelled active ride' 
          : 'Driver cancelled before starting',
        cancellationStage: rideStage,
        timestamp: new Date().toISOString()
      };

      console.log('[ModernDriverDashboard] Cancelling ride:', cancelData);

      cancelRide(cancelData, (response) => {
        console.log('[ModernDriverDashboard] Cancel response:', response);
        
        if (response && response.success) {
          // Clear active ride and reset UI
          actions.setActiveRide(null);
          setRideStage('assigned');
          setShowOTPInput(false);
          setOtpInput('');
          
          // Show success notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Ride Cancelled', {
              body: 'The ride has been cancelled successfully.',
              icon: '/favicon.ico'
            });
          }
          
          alert('Ride cancelled successfully');
        } else {
          alert(response?.message || 'Failed to cancel ride. Please try again.');
        }
      });
    } catch (error) {
      console.error('[ModernDriverDashboard] Error cancelling ride:', error);
      alert('Error cancelling ride. Please try again.');
    }
  };

  // Verify OTP
  const handleOTPVerification = async () => {
    if (otpInput.length < 4 || !activeRide) return;

    console.log('[ModernDriverDashboard] OTP Verification attempt:', {
      rideStage,
      otpInput,
      activeRideId: activeRide._id,
      activeRideEndOTP: activeRide.endOTP,
      verifyingType: rideStage === 'assigned' ? 'START' : 'END'
    });

    try {
      const otpData = {
        rideId: activeRide._id || activeRide.rideId,
        otp: otpInput.trim()
      };

      const handleResponse = (response) => {
        console.log('[ModernDriverDashboard] OTP verification response:', response);
        
        if (response && response.success) {
          console.log('[ModernDriverDashboard] OTP verified successfully');
          setOtpInput('');
          setShowOTPInput(false);
          
          if (rideStage === 'assigned') {
            console.log('[ModernDriverDashboard] Starting ride after OTP verification');
            setRideStage('started');
            actions.setActiveRide({ ...activeRide, status: 'ride_started' });
          } else {
            console.log('[ModernDriverDashboard] Completing ride after OTP verification');
            actions.setActiveRide(null);
            setRideStage('assigned');
          }
        } else {
          console.error('[ModernDriverDashboard] OTP verification failed:', response);
          alert(response?.message || 'Invalid OTP. Please try again.');
        }
      };

      if (rideStage === 'assigned') {
        console.log('[ModernDriverDashboard] Calling verifyStartOTP');
        verifyStartOTP(otpData, handleResponse);
      } else {
        console.log('[ModernDriverDashboard] Calling verifyEndOTP with:', otpData);
        verifyEndOTP(otpData, handleResponse);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
    }
  };

  // Get all rides
  const getAllRides = () => {
    const allRides = [...rideRequests, ...assignedRides];
    return allRides.filter((ride, index, self) =>
      index === self.findIndex((r) => r._id === ride._id)
    );
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driverInfo');
    navigate('/driver/login');
  };

  // Fetch ride history
  const fetchRideHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await drivers.getRideHistory(1, 5, 'all');
      if (response.success && response.data) {
        setRideHistory(response.data.rideHistory);
      }
    } catch (error) {
      console.error('Error fetching ride history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load ride history on mount
  useEffect(() => {
    if (driver && socketConnected) {
      fetchRideHistory();
    }
  }, [driver, socketConnected]);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold text-gray-900">Driver</h1>
          {socketConnected ? (
            <div className="flex items-center text-green-600 text-sm">
              <FaWifi className="mr-1" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600 text-sm">
              <FaExclamationTriangle className="mr-1" />
              <span>Disconnected</span>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <FaSignOutAlt className="text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status Card */}
        <div className="bg-white m-4 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Driver Status</h2>
              {isOnline && queuePosition && (
                <p className="text-sm text-gray-600 mt-1">
                  Queue Position: <span className="font-bold text-blue-600">#{queuePosition}</span>
                  {queuePosition === 1 && <span className="ml-2">🚀 You're next!</span>}
                </p>
              )}
            </div>
            <button
              onClick={toggleOnlineStatus}
              disabled={isLoading || !socketConnected}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                isOnline 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-800 text-white hover:bg-gray-900'
              } ${(!socketConnected || isLoading) && 'opacity-50 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Loading...
                </span>
              ) : (
                <>
                  <FaPowerOff className="inline mr-2" />
                  {isOnline ? 'ONLINE' : 'GO ONLINE'}
                </>
              )}
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <FaWallet className="text-2xl text-green-500 mx-auto mb-1" />
              <p className={`text-2xl font-bold text-gray-800 transition-all duration-500 ${
                showCompletionAnimation ? 'scale-110 text-green-600' : ''
              }`}>
                ₹{earnings}
              </p>
              <p className="text-xs text-gray-500">Today's Earnings</p>
            </div>
            <div className="text-center">
              <FaCar className="text-2xl text-blue-500 mx-auto mb-1" />
              <p className={`text-2xl font-bold text-gray-800 transition-all duration-500 ${
                showCompletionAnimation ? 'scale-110 text-blue-600' : ''
              }`}>
                {tripsToday}
              </p>
              <p className="text-xs text-gray-500">Trips Completed</p>
            </div>
          </div>
        </div>

        {/* Active Ride Card */}
        {activeRide && (
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 m-4 rounded-xl shadow-lg p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Active Ride</h3>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                {rideStage === 'started' ? 'In Progress' : 'Ready to Start'}
              </span>
            </div>

            {/* Customer Info */}
            <div className="bg-white/10 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <FaUser className="mr-2" />
                  <span>{activeRide.userName || 'Customer'}</span>
                </div>
                {activeRide.userPhone && (
                  <a
                    href={`tel:${activeRide.userPhone}`}
                    className="px-3 py-1 bg-white/20 rounded-full text-sm hover:bg-white/30"
                  >
                    <FaPhone className="inline mr-1" />
                    Call
                  </a>
                )}
              </div>
              <div className="text-2xl font-bold">₹{activeRide.estimatedFare || activeRide.fare}</div>
            </div>

            {/* Locations */}
            <div className="space-y-2 mb-4">
              <div className="flex items-start">
                <FaMapMarkerAlt className="text-green-300 mt-1 mr-2" />
                <div className="flex-1">
                  <p className="text-xs opacity-75">Pickup</p>
                  <p className="text-sm">{activeRide.pickupLocation?.boothName || 'Pickup location'}</p>
                </div>
              </div>
              <div className="flex items-start">
                <FaMapMarkerAlt className="text-red-300 mt-1 mr-2" />
                <div className="flex-1">
                  <p className="text-xs opacity-75">Drop</p>
                  <p className="text-sm">{activeRide.dropLocation?.address || 'Drop location'}</p>
                </div>
              </div>
            </div>

            {/* OTP Input */}
            {showOTPInput ? (
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter OTP"
                  className="w-full px-4 py-3 bg-white text-gray-800 rounded-lg text-center text-lg font-bold"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleOTPVerification}
                    disabled={otpInput.length < 4}
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => {
                      setShowOTPInput(false);
                      setOtpInput('');
                    }}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Main action button */}
                <button
                  onClick={() => {
                    console.log('[ModernDriverDashboard] Button clicked:', {
                      rideStage,
                      activeRideId: activeRide?._id,
                      hasStartOTP: !!activeRide?.startOTP,
                      hasEndOTP: !!activeRide?.endOTP,
                      startOTP: activeRide?.startOTP,
                      endOTP: activeRide?.endOTP
                    });
                    
                    if (rideStage === 'assigned') {
                      if (activeRide.startOTP) {
                        console.log('[ModernDriverDashboard] Showing START OTP input');
                        setShowOTPInput(true);
                      } else {
                        console.log('[ModernDriverDashboard] No START OTP required, starting ride');
                        setRideStage('started');
                      }
                    } else {
                      if (activeRide.endOTP) {
                        console.log('[ModernDriverDashboard] Showing END OTP input for OTP:', activeRide.endOTP);
                        setShowOTPInput(true);
                      } else {
                        console.log('[ModernDriverDashboard] No END OTP required, completing ride');
                        actions.setActiveRide(null);
                        setRideStage('assigned');
                      }
                    }
                  }}
                  className="w-full px-4 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  {rideStage === 'assigned' ? 'Start Ride' : 'Complete Ride'}
                </button>
                
                {/* Cancel button */}
                <button
                  onClick={handleCancelRide}
                  className="w-full px-4 py-3 bg-red-500/20 text-white rounded-lg font-semibold hover:bg-red-500/30 transition-colors flex items-center justify-center"
                >
                  <FaTimes className="mr-2" />
                  {rideStage === 'started' ? 'Cancel Active Ride' : 'Cancel Ride'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ride Requests */}
        {!activeRide && (
          <div className="m-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              {getAllRides().length > 0 ? 'Available Rides' : 'No Rides Available'}
            </h3>
            
            {getAllRides().length > 0 ? (
              <div className="space-y-3">
                {getAllRides().map((ride) => (
                  <div
                    key={ride._id || ride.id}
                    className="bg-white rounded-xl shadow-sm p-4 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-800">₹{ride.estimatedFare || ride.fare}</p>
                        <p className="text-sm text-gray-500">{ride.distance || 'N/A'} km</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
                        {ride.vehicleType?.toUpperCase() || 'AUTO'}
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <FaMapMarkerAlt className="text-green-500 mr-2" />
                        <span className="truncate">{ride.pickupLocation?.boothName || 'Pickup'}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <FaMapMarkerAlt className="text-red-500 mr-2" />
                        <span className="truncate">{ride.dropLocation?.address || 'Drop'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => acceptRide(ride)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => rejectRide(ride)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <FaCar className="text-4xl text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {isOnline ? 'Waiting for ride requests...' : 'Go online to receive rides'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ride History Section */}
      {!activeRide && rideHistory.length > 0 && (
        <div className="m-4">
          <div 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FaHistory className="text-gray-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">Recent Rides</h3>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                {rideHistory.length}
              </span>
            </div>
            {showHistory ? <FaChevronUp /> : <FaChevronDown />}
          </div>
          
          {/* Expandable History List */}
          <div className={`transition-all duration-300 overflow-hidden ${
            showHistory ? 'max-h-96 mt-3' : 'max-h-0'
          }`}>
            <div className="space-y-2">
              {rideHistory.map((ride, index) => (
                <div
                  key={ride._id}
                  className={`bg-white rounded-lg p-3 border border-gray-100 transform transition-all duration-500 ${
                    index === 0 && showCompletionAnimation ? 'animate-pulse bg-green-50' : ''
                  }`}
                  style={{
                    animation: index === 0 && showCompletionAnimation ? 'slideIn 0.5s ease-out' : 'none'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <FaCheckCircle className="text-green-500 mr-2" />
                      <span className="font-semibold text-gray-800">₹{ride.actualFare || ride.estimatedFare}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(ride.createdAt || ride.completedAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center">
                      <FaRoute className="mr-1" />
                      <span className="truncate">{ride.pickupLocation?.boothName || 'Pickup'} → {ride.dropLocation?.address || 'Drop'}</span>
                    </div>
                    {ride.userId && (
                      <div className="flex items-center">
                        <FaUser className="mr-1" />
                        <span>{ride.userId.name || 'Customer'}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completion Animation Overlay */}
      {showCompletionAnimation && completedRideDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl p-8 transform scale-100 animate-bounce-in max-w-sm mx-4">
            <div className="text-center">
              {/* Success Icon with Animation */}
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <FaCheckCircle className="text-5xl text-green-500 animate-check-mark" />
                </div>
                {/* Confetti particles */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="confetti-particle bg-yellow-400"></div>
                  <div className="confetti-particle bg-blue-400" style={{animationDelay: '0.1s'}}></div>
                  <div className="confetti-particle bg-green-400" style={{animationDelay: '0.2s'}}></div>
                  <div className="confetti-particle bg-red-400" style={{animationDelay: '0.3s'}}></div>
                  <div className="confetti-particle bg-purple-400" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Ride Completed!</h2>
              <p className="text-gray-600 mb-4">Great job! You've earned</p>
              
              <div className="text-4xl font-bold text-green-600 mb-6 animate-pulse">
                ₹{completedRideDetails.fare}
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-center">
                  <FaClock className="mr-2" />
                  <span>Completed at {new Date(completedRideDetails.completedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-center">
                  <FaUser className="mr-2" />
                  <span>{completedRideDetails.userName || 'Customer'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animations to head */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
        
        @keyframes check-mark {
          0% {
            transform: scale(0) rotate(0deg);
          }
          50% {
            transform: scale(1.2) rotate(360deg);
          }
          100% {
            transform: scale(1) rotate(360deg);
          }
        }
        
        .animate-check-mark {
          animation: check-mark 0.6s ease-out;
        }
        
        .confetti-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: confetti-fall 1s ease-out forwards;
        }
        
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100px) translateX(var(--x-offset, 30px)) rotate(720deg);
            opacity: 0;
          }
        }
        
        .confetti-particle:nth-child(1) { --x-offset: -30px; top: 20px; left: 40px; }
        .confetti-particle:nth-child(2) { --x-offset: 30px; top: 10px; left: 50px; }
        .confetti-particle:nth-child(3) { --x-offset: -20px; top: 30px; left: 30px; }
        .confetti-particle:nth-child(4) { --x-offset: 40px; top: 15px; left: 60px; }
        .confetti-particle:nth-child(5) { --x-offset: -40px; top: 25px; left: 45px; }
      `}</style>

      {/* Mobile Bottom Sheet for Ride Details */}
      {isMobile && selectedRide && (
        <div className={`fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-300 z-50 ${
          showBottomSheet ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3" />
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">Ride Details</h3>
            {/* Ride details content */}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDriverDashboard;