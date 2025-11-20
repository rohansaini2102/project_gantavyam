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
import MapNavigationPanel from '../MapNavigationPanel';
import { openGoogleMapsNavigation } from '../../../services/mapNavigationService';

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

  // Map navigation panel state
  const [showMapPanel, setShowMapPanel] = useState(false);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // Helper function to get driver's earnings (ONLY driver's base fare, no customer charges)
  const getDriverEarnings = (ride) => {
    // Priority 1: Use driverFare field if available (this is the pure driver earnings)
    if (ride.driverFare && ride.driverFare > 0) {
      console.log(`[getDriverEarnings] Using driverFare: ₹${ride.driverFare} for ${ride.userName || 'ride'}`);
      return ride.driverFare;
    }

    // Priority 2: Calculate pure base fare from distance and vehicle type (driver earnings only)
    if (ride.distance && ride.vehicleType) {
      const baseFare = calculatePureBaseFare(ride.distance, ride.vehicleType);
      console.log(`[getDriverEarnings] Calculated base fare: ₹${baseFare} for ${ride.distance}km ${ride.vehicleType}`);
      return baseFare;
    }

    // Priority 3: For legacy data, carefully check if fare field contains driver earnings
    // NOTE: Only use this if fare amount seems reasonable for driver earnings (not customer total)
    if (ride.fare && ride.fare > 0) {
      // Sanity check: driver fare should typically be 25-500 for most rides
      if (ride.fare >= 25 && ride.fare <= 500) {
        console.log(`[getDriverEarnings] Using legacy fare field: ₹${ride.fare} (seems like driver earnings)`);
        return ride.fare;
      } else {
        console.log(`[getDriverEarnings] Legacy fare field too high (₹${ride.fare}), likely customer total - calculating from base`);
        // If fare seems too high, it's probably customer total, so calculate base fare
        return getMinimumFareForVehicle(ride.vehicleType || 'auto');
      }
    }

    // Priority 4: Conservative calculation from customer total (remove charges)
    if (ride.estimatedFare && ride.estimatedFare > 0) {
      // More conservative calculation: remove GST (18%) + commission (20%) + potential surge
      const driverEarnings = Math.round(ride.estimatedFare * 0.6); // Driver gets ~60% of customer fare
      console.log(`[getDriverEarnings] Calculated from estimatedFare: ₹${driverEarnings} (60% of ₹${ride.estimatedFare})`);
      return Math.max(driverEarnings, getMinimumFareForVehicle(ride.vehicleType || 'auto'));
    }

    // Priority 5: Use actualFare as last resort (remove charges)
    if (ride.actualFare && ride.actualFare > 0) {
      const driverEarnings = Math.round(ride.actualFare * 0.6); // Driver gets ~60% of customer fare
      console.log(`[getDriverEarnings] Calculated from actualFare: ₹${driverEarnings} (60% of ₹${ride.actualFare})`);
      return Math.max(driverEarnings, getMinimumFareForVehicle(ride.vehicleType || 'auto'));
    }

    // Last resort: return minimum fare for vehicle type
    const minFare = getMinimumFareForVehicle(ride.vehicleType || 'auto');
    console.log(`[getDriverEarnings] No fare data available, using minimum fare: ₹${minFare} for ${ride.vehicleType || 'auto'}`);
    return minFare;
  };

  // Calculate pure base fare based on distance and vehicle type (matches server FareConfig)
  const calculatePureBaseFare = (distance, vehicleType) => {
    const fareConfig = {
      auto: { baseFare: 40, baseKm: 2, perKmRate: 17, minFare: 40 },
      bike: { baseFare: 30, baseKm: 2, perKmRate: 12, minFare: 30 },
      car: { baseFare: 60, baseKm: 2, perKmRate: 25, minFare: 60 }
    };

    const config = fareConfig[vehicleType] || fareConfig.auto;
    let fare = config.baseFare;

    if (distance > config.baseKm) {
      fare += (distance - config.baseKm) * config.perKmRate;
    }

    return Math.max(Math.round(fare), config.minFare);
  };

  // Get minimum fare for vehicle type (matches server FareConfig)
  const getMinimumFareForVehicle = (vehicleType) => {
    const minFares = {
      auto: 40,
      bike: 30,
      car: 60
    };
    return minFares[vehicleType] || 40;
  };

  // Load driver data on mount and recover active ride if needed
  useEffect(() => {
    console.log('🚀 ModernDriverDashboard Component Loaded - New UI Active!');
    
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
    
    // Check if we need to recover active ride from backup
    if (!activeRide || !activeRide._id) {
      try {
        const backupRide = localStorage.getItem('driver_active_ride_backup');
        if (backupRide) {
          const recoveredRide = JSON.parse(backupRide);
          console.log('[ModernDriverDashboard] Recovering active ride from backup:', recoveredRide);
          
          // Verify the ride has OTP data
          if (recoveredRide._id && (recoveredRide.startOTP || recoveredRide.endOTP)) {
            actions.setActiveRide(recoveredRide);
            setRideStage(recoveredRide.status === 'started' ? 'started' : 'assigned');
            console.log('[ModernDriverDashboard] Active ride recovered successfully with OTPs');
          }
        }
      } catch (error) {
        console.error('[ModernDriverDashboard] Failed to recover active ride:', error);
      }
    } else if (activeRide && (!activeRide.startOTP && !activeRide.endOTP)) {
      // Active ride exists but missing OTP data, try to restore from backup
      try {
        const backupRide = localStorage.getItem('driver_active_ride_backup');
        if (backupRide) {
          const recoveredRide = JSON.parse(backupRide);
          if (recoveredRide._id === activeRide._id && (recoveredRide.startOTP || recoveredRide.endOTP)) {
            console.log('[ModernDriverDashboard] Restoring missing OTP data from backup');
            actions.setActiveRide(recoveredRide);
          }
        }
      } catch (error) {
        console.error('[ModernDriverDashboard] Failed to restore OTP data:', error);
      }
    }
  }, []);

  // Fetch pending rides on component mount
  useEffect(() => {
    const fetchPendingRides = async () => {
      const token = localStorage.getItem('driverToken');
      if (token && !activeRide) {  // Only fetch if no active ride
        try {
          console.log('[ModernDriverDashboard] Fetching pending rides...');
          const result = await drivers.getPendingRides();

          if (result.success && result.data && result.data.rides) {
            console.log('[ModernDriverDashboard] Fetched pending rides:', result.data.rides);

            // Format rides to match our component structure
            const formattedRides = result.data.rides.map(ride => ({
              _id: ride._id || ride.rideId,
              rideId: ride.rideId,
              bookingId: ride.bookingId,
              userName: ride.userName,
              userPhone: ride.userPhone,
              pickupLocation: ride.pickupLocation,
              dropLocation: ride.dropLocation,
              vehicleType: ride.vehicleType,
              distance: ride.distance,
              driverFare: ride.driverFare,  // Store actual driver fare
              fare: ride.driverFare || getDriverEarnings(ride),  // Driver sees their earnings
              estimatedFare: ride.driverFare || getDriverEarnings(ride),  // Use driver fare
              startOTP: ride.startOTP || null,
              endOTP: ride.endOTP || null,
              status: 'pending',
              isManualBooking: ride.bookingSource === 'manual',
              bookingSource: ride.bookingSource || 'app'
            }));

            // Only set rides if we have any
            if (formattedRides.length > 0) {
              setAssignedRides(formattedRides);
              console.log(`[ModernDriverDashboard] Loaded ${formattedRides.length} pending rides`);
            }
          }
        } catch (error) {
          console.error('[ModernDriverDashboard] Error fetching pending rides:', error);
        }
      }
    };

    // Fetch pending rides after a slight delay to ensure socket is ready
    const timer = setTimeout(fetchPendingRides, 500);
    return () => clearTimeout(timer);
  }, [activeRide]);  // Re-fetch if activeRide changes

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
          console.log('[ModernDriverDashboard] Full ride data:', JSON.stringify(data, null, 2));
          
          // Production debugging
          if (window.location.hostname !== 'localhost') {
            console.log('[PRODUCTION] New ride fields:', {
              hasStartOTP: !!data.startOTP,
              hasEndOTP: !!data.endOTP,
              startOTP: data.startOTP,
              endOTP: data.endOTP,
              driverFare: data.driverFare, // Driver's base earnings only
              distance: data.distance,
              vehicleType: data.vehicleType
            });
          }

          // Debug fare fields
          console.log('[driverFare Debug] All fare fields from socket:', {
            driverFare: data.driverFare,
            fare: data.fare,
            estimatedFare: data.estimatedFare,
            customerFare: data.customerFare,
            baseFare: data.baseFare,
            types: {
              driverFare: typeof data.driverFare,
              fare: typeof data.fare,
              estimatedFare: typeof data.estimatedFare
            }
          });
          
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
            driverFare: data.driverFare,  // Store actual driver fare from backend
            fare: data.driverFare || getDriverEarnings(data),  // Use driverFare or fallback to calculation
            estimatedFare: data.driverFare || getDriverEarnings(data),  // Use driverFare or fallback to calculation
            startOTP: data.startOTP || null,
            endOTP: data.endOTP || null,
            status: 'pending',
            isManualBooking: data.isManualBooking || false,
            bookingSource: data.bookingSource || 'online'
          };
          
          console.log('[ModernDriverDashboard] Created ride object with OTPs:', {
            id: newRide._id,
            startOTP: newRide.startOTP,
            endOTP: newRide.endOTP,
            fare: newRide.fare,
            hasOTPs: {
              start: !!newRide.startOTP,
              end: !!newRide.endOTP
            }
          });
          
          setAssignedRides(prev => [newRide, ...prev]);
          
          // Show notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚕 New Ride Request!', {
              body: `${data.userName || 'Customer'} - ₹${data.driverFare || getDriverEarnings(data)}`,
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
            fare: getDriverEarnings(data),  // Use driver fare if available
            estimatedFare: getDriverEarnings(data),  // Use driver fare if available
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
          console.log('[ModernDriverDashboard] Full acceptance data:', JSON.stringify(data, null, 2));
          console.log('[ModernDriverDashboard] Ride OTPs received:', { 
            startOTP: data.startOTP, 
            endOTP: data.endOTP,
            hasStartOTP: !!data.startOTP,
            hasEndOTP: !!data.endOTP
          });
          
          // Production debugging - log all fields
          if (window.location.hostname !== 'localhost') {
            console.log('[PRODUCTION] Ride acceptance data fields:', {
              rideId: data.rideId,
              uniqueRideId: data.uniqueRideId,
              startOTP: data.startOTP,
              endOTP: data.endOTP,
              driverFare: data.driverFare, // Driver's base earnings only
              queueNumber: data.queueNumber,
              queuePosition: data.queuePosition,
              boothRideNumber: data.boothRideNumber
            });
          }
          
          // Find the ride from current state or use data.ride
          setAssignedRides(prev => {
            const acceptedRide = prev.find(r => r._id === data.rideId) || data.ride;
            
            if (acceptedRide) {
              // Set as active ride with all OTP data - ensure all fields are preserved
              const activeRideData = {
                ...acceptedRide,
                _id: data.rideId || acceptedRide._id,
                rideId: data.uniqueRideId || data.rideId || acceptedRide.rideId,
                status: 'accepted',
                queueNumber: data.queueNumber,
                queuePosition: data.queuePosition,
                acceptedAt: data.acceptedAt,
                // CRITICAL: Ensure OTPs are properly set from the acceptance data
                startOTP: data.startOTP || acceptedRide.startOTP || null,
                endOTP: data.endOTP || acceptedRide.endOTP || null,
                // Ensure fare is preserved (driver sees only their earnings)
                driverFare: data.driverFare || acceptedRide.driverFare,
                estimatedFare: data.driverFare || acceptedRide.driverFare || getDriverEarnings(data) || getDriverEarnings(acceptedRide),
                fare: data.driverFare || acceptedRide.driverFare || getDriverEarnings(data) || getDriverEarnings(acceptedRide),
                // Other important fields
                boothRideNumber: data.boothRideNumber || acceptedRide.boothRideNumber,
                userName: acceptedRide.userName,
                userPhone: acceptedRide.userPhone,
                pickupLocation: acceptedRide.pickupLocation,
                dropLocation: acceptedRide.dropLocation,
                vehicleType: acceptedRide.vehicleType,
                distance: acceptedRide.distance
              };
              
              console.log('[ModernDriverDashboard] Setting active ride with complete data:', {
                id: activeRideData._id,
                startOTP: activeRideData.startOTP,
                endOTP: activeRideData.endOTP,
                fare: activeRideData.fare,
                estimatedFare: activeRideData.estimatedFare,
                hasOTPs: {
                  start: !!activeRideData.startOTP,
                  end: !!activeRideData.endOTP
                }
              });
              
              // Production alert for debugging
              if (window.location.hostname !== 'localhost' && (!activeRideData.startOTP || !activeRideData.endOTP)) {
                console.error('[PRODUCTION ERROR] Missing OTP data:', {
                  startOTP: activeRideData.startOTP,
                  endOTP: activeRideData.endOTP,
                  originalData: data
                });
              }
              
              // CRITICAL: Save active ride to localStorage immediately to prevent loss
              try {
                localStorage.setItem('driver_active_ride_backup', JSON.stringify(activeRideData));
                console.log('[ModernDriverDashboard] Active ride backed up to localStorage');
                
                // Production-specific: Also save to a secondary backup
                if (window.location.hostname !== 'localhost') {
                  localStorage.setItem('driver_active_ride_backup_v2', JSON.stringify({
                    ...activeRideData,
                    backupTime: new Date().toISOString(),
                    hasOTPs: !!(activeRideData.startOTP || activeRideData.endOTP)
                  }));
                  console.log('[PRODUCTION] Secondary backup created');
                }
              } catch (error) {
                console.error('[ModernDriverDashboard] Failed to backup active ride:', error);
              }
              
              // FIX 1: Defer state update to avoid render-time updates (fixes React warning)
              // This prevents "Cannot update a component while rendering" error
              setTimeout(() => {
                actions.setActiveRide(activeRideData);
              }, 0);
              
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

          // Store completed ride details for animation (driver sees only their earnings)
          const driverEarnings = data.driverFare || activeRide.driverFare || getDriverEarnings(data.driverFare ? data : activeRide);
          const completedRide = {
            ...activeRide,
            driverFare: driverEarnings,  // Store as driverFare
            fare: driverEarnings,
            completedAt: new Date(),
            status: 'completed'
          };
          setCompletedRideDetails(completedRide);

          // Show completion animation
          setShowCompletionAnimation(true);

          // Update stats with animation (driver earnings only)
          setTripsToday(prev => prev + 1);
          setEarnings(prev => prev + driverEarnings);
          
          // Fetch updated ride history
          fetchRideHistory();
          
          // Clear active ride and animation after delay
          setTimeout(() => {
            actions.setActiveRide(null);
            setRideStage('assigned');
            setShowCompletionAnimation(false);
            setCompletedRideDetails(null);
            
            // Clear the backup since ride is completed
            localStorage.removeItem('driver_active_ride_backup');
            console.log('[ModernDriverDashboard] Cleared active ride backup after completion');
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
          console.log('[ModernDriverDashboard] Queue position update received:', data);
          console.log('[ModernDriverDashboard] Current queue position:', queuePosition);
          console.log('[ModernDriverDashboard] New queue position:', data.queuePosition);

          // Add debug logging for production
          if (window.location.hostname !== 'localhost') {
            console.log('[PRODUCTION] Queue position change:', {
              from: queuePosition,
              to: data.queuePosition,
              action: data.action,
              timestamp: data.timestamp,
              totalOnline: data.totalOnline
            });
          }

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
      `Fare: ₹${activeRide.driverFare || getDriverEarnings(activeRide)}

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
          
          // Clear the backup since ride is cancelled
          localStorage.removeItem('driver_active_ride_backup');
          console.log('[ModernDriverDashboard] Cleared active ride backup after cancellation');
          
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

  // Fetch ride history - Show ONLY driver earnings, never customer fares
  const fetchRideHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await drivers.getRideHistory(1, 30, 'completed'); // Get more rides to filter

      if (response.success && response.data && response.data.rideHistory) {
        console.log(`[ModernDriverDashboard] Fetched ${response.data.rideHistory.length} total completed rides`);

        // Primary filter: ONLY rides that have driverFare field (confirmed driver earnings)
        const ridesWithDriverFare = response.data.rideHistory.filter(ride =>
          ride.driverFare && ride.driverFare > 0
        );

        // Secondary option: Show rides where we can calculate driver earnings from distance/vehicle
        // BUT mark them differently so user knows they're calculated
        const calculableRides = response.data.rideHistory.filter(ride =>
          (!ride.driverFare || ride.driverFare === 0) && // No driverFare
          ride.distance && ride.vehicleType && // But has calculation data
          ride.distance > 0 && ride.distance < 50 // Reasonable distance range
        ).map(ride => ({
          ...ride,
          isCalculated: true, // Mark as calculated for UI display
          calculatedDriverEarnings: calculatePureBaseFare(ride.distance, ride.vehicleType)
        }));

        // Combine both sets, prioritizing rides with actual driverFare
        const allDriverEarningsRides = [
          ...ridesWithDriverFare,
          ...calculableRides.slice(0, 5) // Limit calculated rides
        ];

        console.log(`[ModernDriverDashboard] Driver earnings rides breakdown:`);
        console.log(`  - With driverFare: ${ridesWithDriverFare.length}`);
        console.log(`  - Calculated from distance: ${calculableRides.length}`);
        console.log(`  - Total showing: ${allDriverEarningsRides.length}`);

        // Take only the first 10 rides total
        setRideHistory(allDriverEarningsRides.slice(0, 10));
      }
    } catch (error) {
      console.error('Error fetching ride history:', error);
      setRideHistory([]); // Clear history on error
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

  // Debug: Track queue position changes
  useEffect(() => {
    if (queuePosition !== undefined) {
      const timestamp = new Date().toISOString();
      console.log(`[ModernDriverDashboard] Queue Position Change Detected:`, {
        newPosition: queuePosition,
        timestamp,
        isOnline,
        socketConnected,
        driverId: driver?._id
      });

      // Production debug logging
      if (window.location.hostname !== 'localhost') {
        console.log(`[PRODUCTION] Queue position changed to: ${queuePosition} at ${timestamp}`);
      }
    }
  }, [queuePosition]);

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
              <div className="text-2xl font-bold">₹{activeRide.driverFare || getDriverEarnings(activeRide)}</div>
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
                      endOTP: activeRide?.endOTP,
                      fullActiveRide: activeRide
                    });
                    
                    // Production debugging
                    if (window.location.hostname !== 'localhost') {
                      console.log('[PRODUCTION] Button click - Active ride OTP status:', {
                        stage: rideStage,
                        startOTP: activeRide?.startOTP,
                        endOTP: activeRide?.endOTP,
                        hasStartOTP: !!activeRide?.startOTP,
                        hasEndOTP: !!activeRide?.endOTP,
                        isProduction: true
                      });
                    }
                    
                    if (rideStage === 'assigned') {
                      if (activeRide.startOTP) {
                        console.log('[ModernDriverDashboard] Showing START OTP input for OTP:', activeRide.startOTP);
                        setShowOTPInput(true);
                      } else {
                        console.log('[ModernDriverDashboard] No START OTP required, starting ride directly');
                        setRideStage('started');
                      }
                    } else {
                      if (activeRide.endOTP) {
                        console.log('[ModernDriverDashboard] Showing END OTP input for OTP:', activeRide.endOTP);
                        setShowOTPInput(true);
                      } else {
                        console.log('[ModernDriverDashboard] No END OTP required, completing ride directly');
                        actions.setActiveRide(null);
                        setRideStage('assigned');
                      }
                    }
                  }}
                  className="w-full px-4 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  {rideStage === 'assigned' ? 'Start Ride' : 'Complete Ride'}
                </button>

                {/* Open in Google Maps - Direct Launch */}
                <button
                  onClick={() => {
                    openGoogleMapsNavigation(
                      activeRide.pickupLocation,
                      activeRide.dropLocation
                    );
                  }}
                  className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  <FaRoute className="text-lg" />
                  <span>Open in Google Maps</span>
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

            {/* Map Navigation Panel */}
            <MapNavigationPanel
              isOpen={showMapPanel}
              onClose={() => setShowMapPanel(false)}
              pickupLocation={activeRide.pickupLocation}
              dropLocation={activeRide.dropLocation}
              driverLocation={null}
              rideDetails={{
                fare: activeRide.driverFare || getDriverEarnings(activeRide),
                distance: activeRide.distance,
                vehicleType: activeRide.vehicleType,
              }}
            />
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
                        <p className="text-2xl font-bold text-gray-800">₹{ride.driverFare || getDriverEarnings(ride)}</p>
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

      {/* Recent Rides Section - ONLY rides with driver fare */}
      {!activeRide && (
        <div className="m-4">
          <div
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FaHistory className="text-gray-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">Your Earnings History</h3>
              {rideHistory.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                  {rideHistory.length} rides • driver earnings only
                </span>
              )}
            </div>
            {rideHistory.length > 0 && (showHistory ? <FaChevronUp /> : <FaChevronDown />)}
          </div>

          {/* Expandable History List */}
          {historyLoading ? (
            <div className="bg-white rounded-xl shadow-sm p-6 mt-3">
              <div className="text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                Loading recent rides...
              </div>
            </div>
          ) : rideHistory.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6 mt-3">
              <div className="text-center text-gray-500">
                <FaHistory className="text-4xl text-gray-300 mx-auto mb-3" />
                <p className="font-medium">No Earnings History Available</p>
                <p className="text-sm mt-1">Complete rides to see your driver earnings here</p>
                <p className="text-xs mt-2 text-blue-600">💡 Shows only your earnings, not customer fares</p>
              </div>
            </div>
          ) : (
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
                        {/* Show ONLY driver earnings - never customer fares */}
                        {ride.driverFare && ride.driverFare > 0 ? (
                          <>
                            <span className="font-bold text-green-600 text-lg">₹{ride.driverFare}</span>
                            <span className="ml-1 text-xs text-green-500 font-medium">driver earnings</span>
                          </>
                        ) : ride.isCalculated ? (
                          <>
                            <span className="font-bold text-blue-600 text-lg">₹{ride.calculatedDriverEarnings}</span>
                            <span className="ml-1 text-xs text-blue-500 font-medium">calculated</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-green-600 text-lg">₹{ride.driverFare || getDriverEarnings(ride)}</span>
                            <span className="ml-1 text-xs text-gray-500 font-medium">estimated</span>
                          </>
                        )}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FaUser className="mr-1" />
                          <span>{ride.userName || ride.userId?.name || 'Customer'}</span>
                        </div>
                        {ride.distance && (
                          <span className="text-xs text-gray-500">{ride.distance}km</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clarification about driver earnings display */}
              <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 text-center">
                  <span className="font-medium">💰 Your Earnings Only</span>
                  <br />Shows your base fare earnings, not customer total charges
                </p>
              </div>
            </div>
          )}
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
                ₹{completedRideDetails.driverFare || getDriverEarnings(completedRideDetails)}
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