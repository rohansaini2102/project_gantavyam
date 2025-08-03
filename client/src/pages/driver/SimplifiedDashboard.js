import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { drivers } from '../../services/api';
import { 
  initializeSocket, 
  subscribeToDriverUpdates, 
  unsubscribeFromDriverUpdates, 
  isSocketConnected,
  driverGoOnline,
  driverGoOffline,
  verifyStartOTP,
  verifyEndOTP,
  updateDriverLocation,
  driverAcceptRide
} from '../../services/socket';

const SimplifiedDriverDashboard = () => {
  const navigate = useNavigate();
  
  // Driver state
  const [driver, setDriver] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Driver status
  const [isOnline, setIsOnline] = useState(false);
  const [vehicleType, setVehicleType] = useState('auto');
  const [driverLocation, setDriverLocation] = useState(null);
  
  // Ride state - only assigned rides
  const [assignedRides, setAssignedRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  
  // OTP state
  const [showOTPInput, setShowOTPInput] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  
  // Error handling
  const [statusError, setStatusError] = useState('');
  const [rideError, setRideError] = useState('');
  
  // Current tab (dashboard or assigned)
  const [activeTab, setActiveTab] = useState('dashboard');

  console.log('[SimplifiedDriverDashboard] Component mounted');

  // Authentication check and socket initialization
  useEffect(() => {
    console.log('[SimplifiedDriverDashboard] Checking authentication...');
    const token = localStorage.getItem('driverToken');
    const driverData = localStorage.getItem('driver');
    
    if (!token || !driverData) {
      console.log('[SimplifiedDriverDashboard] No authentication data found');
      navigate('/driver/login');
      return;
    }
    
    try {
      const parsedDriver = JSON.parse(driverData);
      console.log('[SimplifiedDriverDashboard] Driver loaded:', parsedDriver);
      setDriver(parsedDriver);
      
      // Initialize socket connection
      console.log('[SimplifiedDriverDashboard] Initializing socket connection...');
      const initSocket = async () => {
        try {
          const socketInstance = initializeSocket(token);
          
          if (socketInstance && typeof socketInstance.then === 'function') {
            const actualSocket = await socketInstance;
            setSocket(actualSocket);
            
            // Immediately emit room join when socket is ready
            if (actualSocket && actualSocket.connected) {
              console.log('[SimplifiedDriverDashboard] Socket ready, emitting initial room join...');
              actualSocket.emit('driverRoomRejoin', {
                driverId: parsedDriver._id,
                driverName: parsedDriver.fullName,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            setSocket(socketInstance);
            
            // Immediately emit room join when socket is ready
            if (socketInstance && socketInstance.connected) {
              console.log('[SimplifiedDriverDashboard] Socket ready, emitting initial room join...');
              socketInstance.emit('driverRoomRejoin', {
                driverId: parsedDriver._id,
                driverName: parsedDriver.fullName,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error('[SimplifiedDriverDashboard] Socket initialization error:', error);
        }
      };
      
      initSocket();
      
      // Check socket connection status
      const checkConnection = () => {
        const connected = isSocketConnected();
        const wasConnected = socketConnected;
        setSocketConnected(connected);
        console.log('[SimplifiedDriverDashboard] Socket connected:', connected);
        
        // If we just connected (first time or reconnected), emit rejoin event
        if (connected && !wasConnected && socket) {
          console.log('[SimplifiedDriverDashboard] Socket connected/reconnected, joining driver rooms...');
          socket.emit('driverRoomRejoin', {
            driverId: parsedDriver._id,
            driverName: parsedDriver.fullName,
            timestamp: new Date().toISOString()
          });
          
          // Listen for confirmation
          socket.once('roomRejoinConfirmed', (data) => {
            console.log('[SimplifiedDriverDashboard] Room rejoin confirmed:', data);
          });
        }
      };
      
      checkConnection();
      const connectionInterval = setInterval(checkConnection, 3000);
      
      return () => clearInterval(connectionInterval);
      
    } catch (error) {
      console.error('[SimplifiedDriverDashboard] Error parsing driver data:', error);
      navigate('/driver/login');
    }
  }, [navigate]);

  // Load driver dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        console.log('[SimplifiedDriverDashboard] Loading dashboard data...');
        const response = await drivers.getDashboard();
        console.log('[SimplifiedDriverDashboard] Dashboard data:', response.data);
        
        const dashboardData = response.data;
        setIsOnline(dashboardData.driver.isOnline || false);
        setVehicleType(dashboardData.driver.vehicleType || 'auto');
      } catch (error) {
        console.error('[SimplifiedDriverDashboard] Error loading dashboard data:', error);
      }
    };

    if (driver) {
      loadDashboardData();
    }
  }, [driver]);

  // Get driver location tracking
  useEffect(() => {
    console.log('[SimplifiedDriverDashboard] Setting up location tracking...');
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setDriverLocation(location);
          
          // Update location on server if driver is online and has active ride
          if (isOnline && socketConnected && activeRide) {
            updateDriverLocation({
              location,
              rideId: activeRide._id,
              bearing: position.coords.heading,
              speed: position.coords.speed,
              timestamp: new Date().toISOString()
            });
          }
        },
        (error) => {
          console.error('[SimplifiedDriverDashboard] Geolocation error:', error);
          // Default to Delhi center
          setDriverLocation({ lat: 28.6139, lng: 77.2090 });
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, socketConnected, activeRide]);

  // Set up socket listeners for ride assignments
  useEffect(() => {
    // Set up listeners as soon as socket is available, don't wait for connection status
    if (socket) {
      console.log('[SimplifiedDriverDashboard] Setting up socket listeners...');
      console.log('[SimplifiedDriverDashboard] Socket object available, connected:', socketConnected);
      
      subscribeToDriverUpdates({
        onNewRideRequest: (data) => {
          debugger; // DEBUGGER: Ride request received in driver dashboard
          console.log('[SimplifiedDriverDashboard] 🚕 NEW RIDE REQUEST RECEIVED:', data);
          console.log('[SimplifiedDriverDashboard] Full ride data:', JSON.stringify(data, null, 2));
          console.log('[SimplifiedDriverDashboard] Ride ID:', data._id || data.rideId);
          console.log('[SimplifiedDriverDashboard] Booking ID:', data.bookingId);
          console.log('[SimplifiedDriverDashboard] Pickup:', data.pickupLocation?.boothName);
          console.log('[SimplifiedDriverDashboard] Customer:', data.userName);
          console.log('[SimplifiedDriverDashboard] Is Manual Booking:', data.isManualBooking);
          console.log('[SimplifiedDriverDashboard] Booking Source:', data.bookingSource);
          console.log('[SimplifiedDriverDashboard] Current driver:', driver);
          
          // Create new ride object from customer request
          const newRide = {
            _id: data._id || data.rideId,
            rideId: data.rideId,
            bookingId: data.bookingId,
            uniqueRideId: data.rideId,
            boothRideNumber: null, // Will be assigned when accepted
            userName: data.userName,
            userPhone: data.userPhone,
            pickupLocation: data.pickupLocation,
            dropLocation: data.dropLocation,
            vehicleType: data.vehicleType,
            distance: data.distance,
            fare: data.estimatedFare,
            estimatedFare: data.estimatedFare,
            startOTP: data.startOTP,
            endOTP: data.endOTP || null, // May be provided for manual bookings
            status: 'pending',
            timestamp: data.timestamp || new Date().toISOString(),
            paymentStatus: data.isManualBooking ? 'collected' : 'pending',
            autoAssigned: false,
            customerRequest: !data.isManualBooking,
            isManualBooking: data.isManualBooking || false,
            bookingSource: data.bookingSource || 'online',
            queueNumber: data.queueNumber
          };
          
          // Add to assigned rides list
          setAssignedRides(prev => [newRide, ...prev]);
          setRideError('');
          
          // Switch to assigned rides tab
          setActiveTab('assigned');
          
          console.log('[SimplifiedDriverDashboard] Customer ride request added:', newRide);
          
          // Show notification
          const notificationTitle = data.isManualBooking ? '🚕 New Manual Booking!' : '🚕 New Ride Request!';
          const notificationBody = `Customer: ${data.userName || 'Unknown'}\nPickup: ${data.pickupLocation?.boothName}\nDrop: ${data.dropLocation?.address}`;
          const bookingInfo = data.isManualBooking ? `\nBooking ID: ${data.bookingId}\nPayment: Already Collected` : '';
          
          // Always show an alert for immediate attention
          alert(`${notificationTitle}\n\n${notificationBody}\n\nFare: ₹${data.estimatedFare}${bookingInfo}`);
          
          // Also try browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notificationTitle, {
              body: notificationBody,
              icon: '/favicon.ico',
              requireInteraction: true,
              tag: 'ride-request',
              vibrate: [200, 100, 200]
            });
          }
          
          // Request notification permission for future use
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        },
        
        onRideAcceptConfirmed: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride accept confirmed:', data);
          // Update the ride with queue information
          setAssignedRides(prev => prev.map(ride => 
            ride._id === data.rideId 
              ? { 
                  ...ride, 
                  status: 'accepted',
                  queueNumber: data.queueNumber,
                  queuePosition: data.queuePosition,
                  acceptedAt: data.acceptedAt
                }
              : ride
          ));
          setRideError('');
          
          // Show success notification
          const notificationTitle = '✅ Ride Accepted!';
          const notificationBody = data.queueNumber 
            ? `Queue #${data.queueNumber} - Position ${data.queuePosition}`
            : 'You have successfully accepted the ride.';
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notificationTitle, {
              body: notificationBody,
              icon: '/favicon.ico'
            });
          }
        },
        
        onRideAcceptError: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride accept error:', data);
          setRideError(data.message || 'Failed to accept ride');
        },
        
        onRideRequestClosed: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride request closed:', data);
          // Remove the ride from assigned rides if it was accepted by another driver
          setAssignedRides(prev => prev.filter(ride => ride._id !== data.rideId));
        },
        
        onRideAssigned: (data) => {
          console.log('[SimplifiedDriverDashboard] 🚗 RIDE ASSIGNED BY ADMIN:', data);
          console.log('[SimplifiedDriverDashboard] Booking ID:', data.bookingId || data.rideId);
          console.log('[SimplifiedDriverDashboard] Queue Number:', data.queueNumber);
          console.log('[SimplifiedDriverDashboard] Start OTP:', data.startOTP);
          console.log('[SimplifiedDriverDashboard] End OTP:', data.endOTP);
          
          // Create assigned ride object
          const assignedRide = {
            _id: data.rideId,
            rideId: data.bookingId || data.rideId,
            uniqueRideId: data.bookingId || data.rideId,
            bookingId: data.bookingId,
            bookingSource: data.bookingSource || 'manual',
            paymentStatus: data.paymentStatus || 'collected',
            boothRideNumber: data.queueNumber,
            userName: data.user?.name || data.userName,
            userPhone: data.user?.phone || data.userPhone,
            bookingSource: data.bookingSource,
            paymentStatus: data.paymentStatus,
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
            distance: 0,
            fare: data.estimatedFare,
            estimatedFare: data.estimatedFare,
            startOTP: data.startOTP,
            endOTP: data.endOTP,
            status: 'assigned',
            assignedAt: data.assignedAt,
            timestamp: new Date().toISOString(),
            paymentStatus: 'pending',
            autoAssigned: true
          };
          
          setAssignedRides(prev => [assignedRide, ...prev]);
          setRideError('');
          
          // Switch to assigned rides tab
          setActiveTab('assigned');
          
          console.log('[SimplifiedDriverDashboard] Ride added to assigned rides:', assignedRide);
          
          // Show notification
          const notificationTitle = '🚗 New Ride Assigned!';
          const notificationBody = `Ride #${data.queueNumber || 'N/A'}\nCustomer: ${data.user?.name || data.userName || 'Unknown'}\nPickup: ${data.pickupLocation}\nDrop: ${data.dropLocation}`;
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notificationTitle, {
              body: notificationBody,
              icon: '/favicon.ico',
              requireInteraction: true
            });
          } else {
            alert(`${notificationTitle}\n\n${notificationBody}`);
          }
          
          // Request notification permission for future use
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        },
        
        onDriverOnlineConfirmed: (data) => {
          console.log('[SimplifiedDriverDashboard] Driver online confirmed:', data);
          setIsOnline(true);
          setStatusError('');
        },
        
        onDriverOfflineConfirmed: (data) => {
          console.log('[SimplifiedDriverDashboard] Driver offline confirmed:', data);
          setIsOnline(false);
          setAssignedRides([]);
          setActiveRide(null);
          setStatusError('');
        },
        
        onRideStarted: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride started:', data);
          console.log('[SimplifiedDriverDashboard] End OTP received:', data.endOTP);
          
          // Update the active ride with the endOTP received from server
          setActiveRide(prev => ({ 
            ...prev, 
            ...data, 
            status: 'ride_started',
            endOTP: data.endOTP // Ensure endOTP is set when ride starts
          }));
          
          // Also update the ride in assignedRides to keep data consistent
          setAssignedRides(prev => prev.map(ride => 
            ride._id === data.rideId 
              ? { ...ride, ...data, status: 'ride_started', endOTP: data.endOTP }
              : ride
          ));
          
          setShowOTPInput(null);
          setOtpInput('');
        },
        
        onRideEnded: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride ended:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_ended' }));
          setShowOTPInput(null);
        },
        
        onRideCompleted: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride completed:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'completed' }));
          setShowOTPInput(null);
          setRideError('');
          
          // Clear active ride after showing completion message
          setTimeout(() => {
            setActiveRide(null);
            // Remove from assigned rides
            setAssignedRides(prev => prev.filter(ride => ride._id !== data.rideId));
            console.log('[SimplifiedDriverDashboard] ✅ Ride cleared from assigned rides');
          }, 4000);
        },
        
        onRideCancelled: (data) => {
          console.log('[SimplifiedDriverDashboard] Ride cancelled:', data);
          setActiveRide(null);
          setShowOTPInput(null);
          setRideError(`Ride cancelled: ${data.reason || 'No reason provided'}`);
          // Remove from assigned rides
          setAssignedRides(prev => prev.filter(ride => ride._id !== data.rideId));
        },
        
        onOTPVerificationSuccess: (data) => {
          console.log('[SimplifiedDriverDashboard] OTP verification success:', data);
          setShowOTPInput(null);
          setOtpInput('');
          setRideError('');
        },
        
        onOTPVerificationError: (data) => {
          console.log('[SimplifiedDriverDashboard] OTP verification error:', data);
          setRideError(data.message || 'Invalid OTP');
        }
      });

      return () => {
        console.log('[SimplifiedDriverDashboard] Cleaning up socket listeners');
        unsubscribeFromDriverUpdates();
      };
    } else {
      console.log('[SimplifiedDriverDashboard] Socket not available yet, waiting...');
    }
  }, [socket]); // Only depend on socket, not socketConnected

  // Toggle online status
  const toggleOnlineStatus = async () => {
    if (!socketConnected) {
      setStatusError('Socket connection required');
      return;
    }

    if (!isOnline) {
      // Going online - need vehicle type
      if (!vehicleType) {
        setStatusError('Please select vehicle type');
        return;
      }
      
      setStatusError('');
      console.log('[SimplifiedDriverDashboard] Going online...');
      
      driverGoOnline({
        vehicleType: vehicleType,
        location: driverLocation
      });
    } else {
      // Going offline
      console.log('[SimplifiedDriverDashboard] Going offline...');
      driverGoOffline();
    }
  };

  // Start ride with OTP
  const startRide = (ride) => {
    console.log('[SimplifiedDriverDashboard] Starting ride:', ride);
    console.log('[SimplifiedDriverDashboard] Ride has endOTP:', ride.endOTP);
    setActiveRide(ride);
    setShowOTPInput({ type: 'start', label: 'Ask customer for Start OTP' });
  };

  // Complete ride with OTP
  const completeRide = () => {
    console.log('[SimplifiedDriverDashboard] Completing ride, activeRide:', activeRide);
    console.log('[SimplifiedDriverDashboard] Active ride has endOTP:', activeRide?.endOTP);
    if (!activeRide?.endOTP) {
      console.warn('[SimplifiedDriverDashboard] WARNING: No endOTP found in active ride!');
    }
    setShowOTPInput({ type: 'end', label: 'Ask customer for End OTP' });
  };

  // Reject ride request
  const rejectRide = (ride) => {
    console.log('[SimplifiedDriverDashboard] 🚫 REJECTING RIDE:', ride);
    
    if (!socketConnected) {
      setRideError('Socket connection required');
      return;
    }

    if (!driver) {
      setRideError('Driver data not loaded');
      return;
    }
    
    // Confirm rejection
    if (!window.confirm(`Are you sure you want to reject this ride?\n\nCustomer: ${ride.userName}\nPickup: ${ride.pickupLocation?.boothName}\nDrop: ${ride.dropLocation?.address}`)) {
      return;
    }
    
    const rejectData = {
      rideId: ride._id,
      driverId: driver._id || driver.id,
      reason: 'Driver not available'
    };
    
    console.log('[SimplifiedDriverDashboard] Sending reject data:', rejectData);
    
    // Emit rejection event
    if (socket) {
      socket.emit('driverRejectRide', rejectData, (response) => {
        console.log('[SimplifiedDriverDashboard] Reject response:', response);
        if (response && response.success) {
          // Remove from assigned rides
          setAssignedRides(prev => prev.filter(r => r._id !== ride._id));
          setRideError('');
        } else {
          setRideError(response?.message || 'Failed to reject ride');
        }
      });
    }
  };

  // Accept customer ride request
  const acceptRide = (ride) => {
    debugger; // DEBUGGER: Driver accepting ride
    console.log('[SimplifiedDriverDashboard] 🎯 ACCEPTING RIDE:', ride);
    console.log('[SimplifiedDriverDashboard] Ride details:', {
      rideId: ride._id,
      bookingId: ride.bookingId,
      isManualBooking: ride.isManualBooking,
      customer: ride.userName,
      fullRide: ride
    });
    
    if (!socketConnected) {
      setRideError('Socket connection required');
      return;
    }

    if (!driver) {
      setRideError('Driver data not loaded');
      return;
    }

    console.log('[SimplifiedDriverDashboard] Driver details:', driver);
    setRideError('');
    
    // Send complete driver data for queue management
    const acceptData = {
      rideId: ride._id,
      driverId: driver._id || driver.id,
      driverName: driver.fullName || driver.name,
      driverPhone: driver.phone || driver.mobileNo,
      vehicleDetails: {
        type: vehicleType,
        number: driver.vehicleNumber || driver.vehicleNo
      },
      currentLocation: driverLocation
    };
    
    console.log('[SimplifiedDriverDashboard] Sending accept data:', acceptData);
    driverAcceptRide(acceptData);
  };

  // Handle OTP verification
  const handleOTPVerification = () => {
    if (!otpInput.trim()) {
      setRideError('Please enter OTP');
      return;
    }

    if (!activeRide) {
      setRideError('No active ride found');
      return;
    }

    // For end OTP verification, check if the ride has been started and has endOTP
    if (showOTPInput.type === 'end' && activeRide.status !== 'ride_started') {
      setRideError('Please start the ride first before ending it');
      return;
    }

    const otpData = {
      rideId: activeRide._id || activeRide.rideId,
      otp: otpInput.trim()
    };

    console.log('[SimplifiedDriverDashboard] Verifying OTP:', {
      type: showOTPInput.type,
      rideId: otpData.rideId,
      otp: otpData.otp,
      rideStatus: activeRide.status,
      hasEndOTP: !!activeRide.endOTP
    });

    const handleOTPResponse = (response) => {
      console.log('[SimplifiedDriverDashboard] OTP verification response:', response);
      
      if (response && response.success) {
        console.log('[SimplifiedDriverDashboard] OTP verified successfully');
        setOtpInput('');
        setShowOTPInput(null);
        setRideError('');
        
        // Update ride status based on OTP type
        if (showOTPInput.type === 'start') {
          setActiveRide(prev => ({ ...prev, status: 'ride_started' }));
        } else if (showOTPInput.type === 'end') {
          setActiveRide(prev => ({ ...prev, status: 'ride_ended' }));
        }
      } else {
        console.error('[SimplifiedDriverDashboard] OTP verification failed:', response);
        setRideError(response?.message || 'Invalid OTP. Please try again.');
      }
    };

    if (showOTPInput.type === 'start') {
      verifyStartOTP(otpData, handleOTPResponse);
    } else if (showOTPInput.type === 'end') {
      verifyEndOTP(otpData, handleOTPResponse);
    }
  };

  // Logout
  const handleLogout = () => {
    console.log('[SimplifiedDriverDashboard] Logging out...');
    unsubscribeFromDriverUpdates();
    if (isOnline) {
      driverGoOffline();
    }
    localStorage.removeItem('driver');
    localStorage.removeItem('driverToken');
    navigate('/driver/login');
  };

  if (!driver) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold">Driver Dashboard</h1>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              socketConnected ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm">Welcome, {driver.fullName || driver.name}</span>
            <button
              onClick={toggleOnlineStatus}
              disabled={!socketConnected}
              className={`px-4 py-2 rounded font-bold transition-colors ${
                !socketConnected ? 'bg-gray-500 cursor-not-allowed' : 
                isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded font-bold transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto">
        
        {/* Error Displays */}
        {statusError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            <strong>Status Error:</strong> {statusError}
          </div>
        )}
        
        {rideError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            <strong>Ride Error:</strong> {rideError}
          </div>
        )}

        {/* Tab Navigation - Only Dashboard and Assigned Rides */}
        <div className="flex bg-gray-100 rounded-t-lg border-b-2 border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 px-4 py-3 text-center font-bold transition-all duration-300 rounded-tl-lg ${
              activeTab === 'dashboard' 
                ? 'bg-blue-500 text-white' 
                : 'bg-transparent text-blue-500 hover:bg-blue-50'
            }`}
          >
            <span className="text-sm lg:text-base">🏠 Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex-1 px-4 py-3 text-center font-bold transition-all duration-300 rounded-tr-lg ${
              activeTab === 'assigned' 
                ? 'bg-blue-500 text-white' 
                : 'bg-transparent text-blue-500 hover:bg-blue-50'
            }`}
          >
            <span className="text-sm lg:text-base">📋 Assigned Rides ({assignedRides.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Driver Status Panel */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Driver Status</h3>
              
              {/* Current Status */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xl font-bold ${
                    isOnline ? 'text-green-500' : 'text-gray-500'
                  }`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <button
                    onClick={toggleOnlineStatus}
                    disabled={!socketConnected}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      !socketConnected ? 'bg-gray-500 cursor-not-allowed' : 
                      isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                  >
                    {isOnline ? 'Go Offline' : 'Go Online'}
                  </button>
                </div>
                
                {driverLocation && (
                  <p className="text-gray-600 text-sm">
                    📍 Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>

              {/* Vehicle Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Vehicle Type:
                </label>
                <div className="flex gap-3">
                  {['bike', 'auto', 'car'].map(type => (
                    <label key={type} className={`flex items-center gap-2 ${
                      isOnline ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}>
                      <input
                        type="radio"
                        name="vehicleType"
                        value={type}
                        checked={vehicleType === type}
                        onChange={(e) => setVehicleType(e.target.value)}
                        disabled={isOnline}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Map View</h3>
              <div className="h-96 rounded-lg overflow-hidden">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={driverLocation || { lat: 28.6139, lng: 77.2090 }}
                  zoom={12}
                >
                  {/* Driver location */}
                  {driverLocation && (
                    <Marker
                      position={driverLocation}
                      icon={{
                        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        scaledSize: new window.google.maps.Size(40, 40)
                      }}
                      title="Your Location"
                    />
                  )}

                  {/* Active ride pickup */}
                  {activeRide && (
                    <Marker
                      position={{
                        lat: activeRide.pickupLocation?.latitude || activeRide.pickupLocation?.lat,
                        lng: activeRide.pickupLocation?.longitude || activeRide.pickupLocation?.lng
                      }}
                      icon={{
                        url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                        scaledSize: new window.google.maps.Size(40, 40)
                      }}
                      title={`Active Pickup: ${activeRide.pickupLocation?.boothName}`}
                    />
                  )}
                </GoogleMap>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Rides Tab */}
        {activeTab === 'assigned' && (
          <div className="space-y-6">
            
            {/* Active Ride (if any) */}
            {activeRide && (
              <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  🚗 Active Ride
                  {activeRide.boothRideNumber && (
                    <span className="ml-3 px-3 py-1 bg-yellow-400 text-black rounded text-sm">
                      #{activeRide.boothRideNumber}
                    </span>
                  )}
                </h3>
                
                {/* Rider Information */}
                <div className="bg-white p-4 rounded-lg mb-4">
                  <h4 className="font-semibold mb-2">🚶 Customer Information</h4>
                  <p className="text-lg font-bold">{activeRide.userName || 'Unknown'}</p>
                  {activeRide.userPhone && (
                    <div className="flex items-center gap-2 mt-2">
                      <span>📞 {activeRide.userPhone}</span>
                      <a 
                        href={`tel:${activeRide.userPhone}`}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      >
                        Call
                      </a>
                    </div>
                  )}
                </div>
                
                {/* Trip Details */}
                <div className="bg-white p-4 rounded-lg mb-4">
                  <h4 className="font-semibold mb-2">📍 Trip Details</h4>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-green-600">Pickup:</strong>
                      <div className="ml-4">{activeRide.pickupLocation?.boothName || 'Not specified'}</div>
                    </div>
                    <div>
                      <strong className="text-red-600">Drop:</strong>
                      <div className="ml-4">{activeRide.dropLocation?.address || 'Not specified'}</div>
                    </div>
                    <div>
                      <strong>Vehicle:</strong> {activeRide.vehicleType?.toUpperCase()}
                    </div>
                    <div>
                      <strong>Fare:</strong> ₹{activeRide.fare || activeRide.estimatedFare}
                    </div>
                  </div>
                </div>
                
                {/* Status and Actions */}
                <div className="text-center mb-4">
                  <span className={`px-4 py-2 rounded font-bold ${
                    activeRide.status === 'assigned' ? 'bg-blue-500 text-white' :
                    activeRide.status === 'ride_started' ? 'bg-green-500 text-white' :
                    activeRide.status === 'ride_ended' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {activeRide.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Action Buttons */}
                {activeRide.status === 'assigned' && (
                  <div className="text-center">
                    <button
                      onClick={() => setShowOTPInput({ type: 'start', label: 'Ask customer for Start OTP' })}
                      className="w-full max-w-md px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600"
                    >
                      🚀 Start Ride (Enter Start OTP)
                    </button>
                  </div>
                )}

                {activeRide.status === 'ride_started' && (
                  <div className="text-center">
                    <button
                      onClick={completeRide}
                      className="w-full max-w-md px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      🏁 Complete Ride (Enter End OTP)
                    </button>
                  </div>
                )}

                {/* Ride Completion Status */}
                {activeRide.status === 'ride_ended' && (
                  <div className="bg-yellow-100 p-4 rounded-lg text-center">
                    <div className="text-lg font-bold text-yellow-800">
                      🏁 Ride Ended - Processing...
                    </div>
                    <div className="text-sm text-yellow-700 mt-2">
                      Payment collection and ride completion in progress
                    </div>
                  </div>
                )}

                {activeRide.status === 'completed' && (
                  <div className="bg-green-100 p-4 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-800">
                      ✅ Ride Completed Successfully!
                    </div>
                    <div className="text-sm text-green-700 mt-2">
                      Payment: ₹{activeRide.actualFare || activeRide.fare || activeRide.estimatedFare} (Cash)
                    </div>
                  </div>
                )}

                {/* OTP Input */}
                {showOTPInput && (
                  <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg mt-4">
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-bold text-blue-800">
                        {showOTPInput.type === 'start' ? '🚀 Start Ride Verification' : '🏁 End Ride Verification'}
                      </h4>
                      <p className="text-sm text-blue-600">
                        {showOTPInput.type === 'start' ? 
                          'Ask the customer for their Start OTP' : 
                          'Ask the customer for their End OTP'
                        }
                      </p>
                    </div>
                    
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Enter 4-digit OTP"
                        maxLength="4"
                        className="flex-1 p-3 border-2 border-blue-300 rounded-lg text-center text-lg font-bold"
                        autoFocus
                      />
                      <button
                        onClick={handleOTPVerification}
                        disabled={otpInput.length !== 4}
                        className={`px-6 py-3 rounded-lg font-bold ${
                          otpInput.length === 4 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Verify
                      </button>
                    </div>
                    
                    <div className="text-center mt-3">
                      <button
                        onClick={() => {
                          setShowOTPInput(null);
                          setOtpInput('');
                        }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Assigned Rides List */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                📋 Assigned Rides ({assignedRides.length})
              </h3>
              
              {assignedRides.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isOnline ? 
                    'No rides assigned yet. Admin will assign rides manually.' :
                    'Go online to receive ride assignments.'
                  }
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedRides.map(ride => (
                    <div 
                      key={ride._id}
                      className={`p-4 border rounded-lg ${
                        activeRide?._id === ride._id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* Ride Number */}
                      {ride.boothRideNumber && (
                        <div className="bg-blue-500 text-white px-3 py-1 rounded text-center font-bold mb-3">
                          Ride #{ride.boothRideNumber}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg">{ride.userName}</h4>
                          <p className="text-sm text-gray-600">📞 {ride.userPhone}</p>
                          <p className="text-sm text-gray-600">📍 {ride.pickupLocation?.boothName} → {ride.dropLocation?.address}</p>
                          <p className="text-sm text-gray-600">🚗 {ride.vehicleType?.toUpperCase()}</p>
                          <p className="text-xs text-gray-500">🕒 {new Date(ride.timestamp).toLocaleString()}</p>
                          {/* Show manual booking indicator */}
                          {ride.bookingSource === 'manual' && (
                            <div className="mt-2">
                              <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                📋 Manual Booking
                              </span>
                              {ride.paymentStatus === 'collected' && (
                                <span className="inline-block ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                  💰 Payment Collected
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">₹{ride.fare || ride.estimatedFare}</div>
                          {activeRide?._id !== ride._id && (
                            <>
                              {ride.status === 'pending' ? (
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => acceptRide(ride)}
                                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-bold"
                                  >
                                    ✅ Accept
                                  </button>
                                  <button
                                    onClick={() => rejectRide(ride)}
                                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-bold"
                                  >
                                    ❌ Reject
                                  </button>
                                </div>
                              ) : (ride.status === 'driver_assigned' || ride.status === 'assigned' || ride.status === 'accepted') ? (
                                <button
                                  onClick={() => startRide(ride)}
                                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                  Start Ride
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default SimplifiedDriverDashboard;