const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const RideHistory = require('../../models/RideHistory');
const BoothQueue = require('../../models/BoothQueue');
const PickupLocation = require('../../models/PickupLocation');
const { adminProtect } = require('../../middleware/auth');
const { notifyAdmins } = require('../../socket');

// Apply admin protection to all routes
router.use(adminProtect);

// GET /admin/rides - Get all rides with filtering options
router.get('/', async (req, res) => {
  try {
    const {
      booth,
      status,
      startDate,
      endDate,
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Filter by booth if specified
    if (booth && booth !== 'all') {
      // Support both string and object formats for pickupLocation
      filter.$or = [
        { pickupLocation: booth },
        { 'pickupLocation.boothName': booth },
        { 'pickupLocation.boothName': { $regex: new RegExp(booth, 'i') } },
        { pickupLocation: { $regex: new RegExp(booth, 'i') } }
      ];
    }
    
    // Filter by status if specified
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Filter by date range if specified - use createdAt field (preferred) with timestamp fallback
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }
      
      // Use createdAt field for date filtering (modern rides) and fallback to timestamp (legacy rides)
      filter.createdAt = dateFilter;
      
      console.log('📅 [Admin Rides] Date filter applied:', {
        startDate,
        endDate,
        dateFilter
      });
    } else {
      console.log('📅 [Admin Rides] No date filter - showing all rides');
    }

    // Build sort object with priority for active rides
    let sort = {};
    
    // Define status priority: NEW RIDES FIRST - pending now has highest priority
    const statusPriority = {
      'pending': 1,        // NEW RIDES FIRST
      'driver_assigned': 2,
      'ride_started': 3,
      'ride_ended': 4,
      'completed': 5,
      'cancelled': 6
    };
    
    // If no specific sorting requested, sort by status priority first, then by creation date
    if (sortBy === 'createdAt') {
      // Custom sorting: active rides first, then by date
      sort = [
        { status: 1 }, // This will be handled in aggregation
        { createdAt: sortOrder === 'desc' ? -1 : 1 },
        { timestamp: sortOrder === 'desc' ? -1 : 1 } // Fallback for old records
      ];
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    console.log('🔍 [Admin Rides] Filter:', JSON.stringify(filter, null, 2));
    console.log('🔍 [Admin Rides] Sort:', sort);
    
    // Debug: Check total rides in database
    const totalRidesInDb = await RideRequest.countDocuments({});
    const totalRecentRides = await RideRequest.countDocuments({
      $or: [
        { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    });
    console.log(`📊 [Admin Rides] Total rides in DB: ${totalRidesInDb}, Recent (24h): ${totalRecentRides}`);

    // FIXED: Query both RideRequest and RideHistory collections
    console.log('⚡ [Admin Rides] Querying both RideRequest and RideHistory collections');
    
    // Build filter for RideHistory (convert field names)
    const historyFilter = {};
    if (filter.$or) {
      // Handle booth filter for RideHistory
      historyFilter.$or = [
        { 'pickupLocation.boothName': filter.$or[0].pickupLocation || filter.$or[0]['pickupLocation.boothName'] }
      ];
    }
    if (filter.status) {
      // Map status to RideHistory status
      if (filter.status === 'ride_ended' || filter.status === 'completed') {
        historyFilter.status = 'completed';
      } else if (filter.status === 'cancelled') {
        historyFilter.status = 'cancelled';
      } else {
        // For other statuses, only search RideRequest
        historyFilter.status = 'nonexistent';
      }
    }
    if (filter.createdAt) {
      historyFilter['timestamps.requested'] = filter.createdAt;
    }

    // Query RideRequest (active rides)
    const activeRidesPromise = RideRequest.find(filter)
      .populate('userId', 'name email phone')
      .populate('driverId', 'fullName name vehicleNumber phone vehicleNo mobileNo rating')
      .lean();

    // Query RideHistory (completed/cancelled rides)
    const historyRidesPromise = RideHistory.find(historyFilter)
      .populate('userId', 'name email phone')
      .populate('driverId', 'fullName name vehicleNumber phone vehicleNo mobileNo rating')
      .lean();

    // Execute both queries in parallel
    const [activeRides, historyRides] = await Promise.all([activeRidesPromise, historyRidesPromise]);

    // FIXED: Normalize RideRequest data to ensure destination field exists
    activeRides.forEach(ride => {
      // Ensure destination field is set from dropLocation.address
      if (!ride.destination && ride.dropLocation?.address) {
        ride.destination = ride.dropLocation.address;
      } else if (!ride.destination) {
        ride.destination = 'Not specified';
      }
    });

    // Normalize RideHistory data to match RideRequest format
    const normalizedHistoryRides = historyRides.map(ride => ({
      _id: ride._id,
      rideId: ride.rideId,
      status: ride.status === 'completed' ? 'completed' : ride.status,
      pickupLocation: ride.pickupLocation?.boothName || ride.pickupLocation,
      destination: ride.dropLocation?.address || 'Not specified',
      userId: ride.userId,
      driverId: ride.driverId,
      // Use driver info from embedded fields if populate failed
      driverName: ride.driverId?.name || ride.driverId?.fullName || ride.driverName,
      driverPhone: ride.driverId?.phone || ride.driverId?.mobileNo || ride.driverPhone,
      driverVehicleNo: ride.driverId?.vehicleNumber || ride.driverId?.vehicleNo || ride.driverVehicleNo,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      distance: ride.distance,
      vehicleType: ride.vehicleType,
      queueNumber: ride.boothRideNumber,
      createdAt: ride.timestamps?.requested || ride.createdAt,
      completedAt: ride.timestamps?.completed,
      paymentStatus: ride.paymentStatus,
      paymentMethod: ride.paymentMethod
    }));

    // Combine and sort all rides
    const allRides = [...activeRides, ...normalizedHistoryRides];
    allRides.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.createdAt || b.timestamp || 0);
      return dateB - dateA; // Newest first
    });

    // Apply pagination to combined results
    const rides = allRides.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
    
    console.log(`⚡ [Admin Rides] Combined query returned ${rides.length} rides (${activeRides.length} active + ${normalizedHistoryRides.length} history)`);

    // Get total count from both collections
    const [activeCount, historyCount] = await Promise.all([
      RideRequest.countDocuments(filter),
      RideHistory.countDocuments(historyFilter)
    ]);
    const totalCount = activeCount + historyCount;

    // Enhanced data normalization for combined rides data
    rides.forEach(ride => {
      // Ensure createdAt field exists for old records
      if (!ride.createdAt && ride.timestamp) {
        ride.createdAt = ride.timestamp;
      }
      
      // Normalize pickupLocation format
      if (typeof ride.pickupLocation === 'object' && ride.pickupLocation?.boothName) {
        ride.pickupLocation = ride.pickupLocation.boothName;
      }
      
      // Note: destination field is now set earlier in the process
      
      // Fix driver info display - use populated driver data as fallback
      if (ride.driverId && typeof ride.driverId === 'object') {
        // Driver is populated, use it as fallback for missing fields
        if (!ride.driverName && (ride.driverId.fullName || ride.driverId.name)) {
          ride.driverName = ride.driverId.fullName || ride.driverId.name;
        }
        if (!ride.driverPhone && (ride.driverId.mobileNo || ride.driverId.phone)) {
          ride.driverPhone = ride.driverId.mobileNo || ride.driverId.phone;
        }
        if (!ride.driverVehicleNo && ride.driverId.vehicleNo) {
          ride.driverVehicleNo = ride.driverId.vehicleNo;
        }
        if (!ride.driverRating && ride.driverId.rating) {
          ride.driverRating = ride.driverId.rating;
        }
      }
      
      // For rides from RideHistory, ensure proper mapping
      if (ride.status === 'completed' && ride.completedAt) {
        ride.rideEndedAt = ride.completedAt;
      }
      
      // Mark rides with missing driver info for admin attention
      if (!ride.driverId || (!ride.driverName && !ride.driverPhone)) {
        ride.missingDriverInfo = true;
      }
    });

    console.log(`✅ [Admin Rides] Retrieved ${rides.length} rides out of ${totalCount} total`);
    console.log(`✅ [Admin Rides] Sample ride:`, rides[0] ? {
      id: rides[0]._id,
      status: rides[0].status,
      pickupLocation: rides[0].pickupLocation,
      destination: rides[0].destination,
      dropLocation: rides[0].dropLocation,
      userId: rides[0].userId?.name || 'No user',
      driverId: rides[0].driverId?.name || 'No driver',
      createdAt: rides[0].createdAt,
      timestamp: rides[0].timestamp
    } : 'No rides found');
    
    // DEBUG: Log dropLocation data for first few rides
    console.log(`🔍 [DEBUG] Drop location data for first 3 rides:`);
    rides.slice(0, 3).forEach((ride, index) => {
      console.log(`  Ride ${index + 1} (${ride._id}):`, {
        destination: ride.destination,
        dropLocation: ride.dropLocation,
        hasDropLocation: !!ride.dropLocation,
        hasDestination: !!ride.destination,
        dropLocationAddress: ride.dropLocation?.address,
        destinationType: typeof ride.destination,
        destinationLength: ride.destination?.length
      });
    });
    
    // DEBUG: Enhanced drop-off location analysis
    const ridesWithDestination = rides.filter(ride => ride.destination && ride.destination !== 'Not specified').length;
    const ridesWithoutDestination = rides.length - ridesWithDestination;
    const ridesWithDropLocation = rides.filter(ride => ride.dropLocation && ride.dropLocation.address).length;
    const ridesWithDropLocationButNoDestination = rides.filter(ride => 
      ride.dropLocation && ride.dropLocation.address && 
      (!ride.destination || ride.destination === 'Not specified')
    ).length;
    
    console.log(`🔍 [DEBUG] Drop-off Location Analysis:`);
    console.log(`  Total rides: ${rides.length}`);
    console.log(`  Rides with destination field: ${ridesWithDestination}`);
    console.log(`  Rides without destination: ${ridesWithoutDestination}`);
    console.log(`  Rides with dropLocation.address: ${ridesWithDropLocation}`);
    console.log(`  Rides with dropLocation but no destination: ${ridesWithDropLocationButNoDestination}`);
    
    if (ridesWithDropLocationButNoDestination > 0) {
      console.log(`⚠️  [DEBUG] ${ridesWithDropLocationButNoDestination} rides have dropLocation.address but missing destination field!`);
      const samples = rides.filter(ride => 
        ride.dropLocation && ride.dropLocation.address && 
        (!ride.destination || ride.destination === 'Not specified')
      ).slice(0, 3);
      
      samples.forEach((ride, index) => {
        console.log(`    Sample ${index + 1}: dropLocation.address="${ride.dropLocation.address}", destination="${ride.destination}"`);
      });
    }
    
    // DEBUG: Log the actual API response structure for first ride
    if (rides[0]) {
      console.log(`🔍 [DEBUG] Sample API response structure:`, {
        _id: rides[0]._id,
        status: rides[0].status,
        destination: rides[0].destination,
        pickupLocation: rides[0].pickupLocation,
        userId: rides[0].userId,
        hasDestination: !!rides[0].destination
      });
    }

    res.status(200).json({
      success: true,
      data: {
        rides: rides,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + rides.length < totalCount
        }
      }
    });

  } catch (error) {
    console.error('❌ [Admin Rides] Error fetching rides:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rides',
      error: error.message
    });
  }
});

// GET /admin/rides/booth/:boothName - Get rides for specific booth
router.get('/booth/:boothName', async (req, res) => {
  try {
    const { boothName } = req.params;
    const { 
      status,
      date = new Date().toISOString().split('T')[0],
      includeHistory = false 
    } = req.query;

    console.log(`🏢 [Admin Booth Rides] Fetching rides for booth: ${boothName}`);
    console.log(`📅 Date: ${date}, Status: ${status}, Include History: ${includeHistory}`);

    // Build filter for booth-specific rides (support both string and object formats)
    const filter = {
      $or: [
        { pickupLocation: boothName },
        { 'pickupLocation.boothName': boothName }
      ]
    };
    
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Filter by date if not including history
    if (!includeHistory) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      filter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    // Get rides for the booth
    const rides = await RideRequest.find(filter)
      .populate('userId', 'name email phone')
      .populate('driverId', 'fullName name vehicleNumber phone vehicleNo mobileNo rating')
      .sort({ createdAt: -1 })
      .lean();

    // Normalize pickupLocation and fix driver info in booth rides
    rides.forEach(ride => {
      if (typeof ride.pickupLocation === 'object' && ride.pickupLocation?.boothName) {
        ride.pickupLocation = ride.pickupLocation.boothName;
      }
      
      // FIXED: Map dropLocation.address to destination for consistency
      if (!ride.destination && ride.dropLocation) {
        ride.destination = ride.dropLocation.address || 'Not specified';
      }
      
      // Fix driver info display using populated data as fallback
      if (ride.driverId && typeof ride.driverId === 'object') {
        if (!ride.driverName && (ride.driverId.fullName || ride.driverId.name)) {
          ride.driverName = ride.driverId.fullName || ride.driverId.name;
        }
        if (!ride.driverPhone && (ride.driverId.mobileNo || ride.driverId.phone)) {
          ride.driverPhone = ride.driverId.mobileNo || ride.driverId.phone;
        }
        if (!ride.driverVehicleNo && ride.driverId.vehicleNo) {
          ride.driverVehicleNo = ride.driverId.vehicleNo;
        }
      }
      
      // Mark rides with missing driver info
      if (!ride.driverId || (!ride.driverName && !ride.driverPhone)) {
        ride.missingDriverInfo = true;
      }
    });

    // Get booth queue information
    const boothQueue = await BoothQueue.findOne({
      boothName: boothName,
      date: date
    });

    let queueInfo = null;
    if (boothQueue) {
      queueInfo = boothQueue.getQueueStatus();
    }

    // Get booth location details
    const boothLocation = await PickupLocation.findOne({
      name: { $regex: new RegExp(boothName, 'i') }
    });

    console.log(`✅ [Admin Booth Rides] Found ${rides.length} rides for ${boothName}`);

    res.status(200).json({
      success: true,
      data: {
        boothName,
        boothLocation,
        rides,
        queueInfo,
        date,
        totalRides: rides.length
      }
    });

  } catch (error) {
    console.error('❌ [Admin Booth Rides] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booth rides',
      error: error.message
    });
  }
});

// GET /admin/rides/:rideId - Get detailed ride information
router.get('/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;

    console.log(`🔍 [Admin Ride Details] Fetching ride: ${rideId}`);

    // Search in both RideRequest and RideHistory collections
    let ride = await RideRequest.findById(rideId)
      .populate('userId', 'name email phone createdAt')
      .populate('driverId', 'fullName name vehicleNumber phone vehicleNo mobileNo rating totalRides')
      .lean();

    let isFromHistory = false;
    
    // If not found in RideRequest, search in RideHistory
    if (!ride) {
      console.log(`🔍 [Admin Ride Details] Not found in RideRequest, searching RideHistory: ${rideId}`);
      ride = await RideHistory.findById(rideId)
        .populate('userId', 'name email phone createdAt')
        .populate('driverId', 'fullName name vehicleNumber phone vehicleNo mobileNo rating totalRides')
        .lean();
      
      if (ride) {
        isFromHistory = true;
        console.log(`✅ [Admin Ride Details] Found ride in RideHistory: ${rideId}`);
        
        // Normalize RideHistory data to match RideRequest format
        ride = {
          ...ride,
          pickupLocation: ride.pickupLocation?.boothName || ride.pickupLocation,
          destination: ride.dropLocation?.address || ride.destination,
          // Map timestamps to expected fields
          createdAt: ride.timestamps?.requested || ride.createdAt,
          acceptedAt: ride.timestamps?.driverAssigned,
          rideStartedAt: ride.timestamps?.rideStarted,
          rideEndedAt: ride.timestamps?.rideEnded,
          completedAt: ride.timestamps?.completed,
          cancelledAt: ride.timestamps?.cancelled,
          queueNumber: ride.boothRideNumber,
          // Ensure driver info is available
          driverName: ride.driverId?.name || ride.driverId?.fullName || ride.driverName,
          driverPhone: ride.driverId?.phone || ride.driverId?.mobileNo || ride.driverPhone,
          driverVehicleNo: ride.driverId?.vehicleNumber || ride.driverId?.vehicleNo || ride.driverVehicleNo
        };
      }
    }
      
    // FIXED: Map dropLocation.address to destination for RideRequest records (if not already mapped)
    if (ride && !ride.destination && ride.dropLocation) {
      ride.destination = ride.dropLocation.address || 'Not specified';
    }
    
    // Fix driver info if populated but fields are missing
    if (ride && ride.driverId && typeof ride.driverId === 'object') {
      if (!ride.driverName && (ride.driverId.fullName || ride.driverId.name)) {
        ride.driverName = ride.driverId.fullName || ride.driverId.name;
      }
      if (!ride.driverPhone && (ride.driverId.mobileNo || ride.driverId.phone)) {
        ride.driverPhone = ride.driverId.mobileNo || ride.driverId.phone;
      }
      if (!ride.driverVehicleNo && ride.driverId.vehicleNo) {
        ride.driverVehicleNo = ride.driverId.vehicleNo;
      }
      if (!ride.driverRating && ride.driverId.rating) {
        ride.driverRating = ride.driverId.rating;
      }
    }
    
    // Mark if driver info is missing
    if (ride && (!ride.driverId || (!ride.driverName && !ride.driverPhone))) {
      ride.missingDriverInfo = true;
    }

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Get booth queue information if available
    let queueInfo = null;
    if (ride.queueNumber && ride.pickupLocation) {
      const today = new Date().toISOString().split('T')[0];
      const boothQueue = await BoothQueue.findOne({
        boothName: ride.pickupLocation,
        date: today
      });

      if (boothQueue) {
        queueInfo = boothQueue.getQueueStatus();
        
        // Find this specific ride in the queue
        const rideInQueue = boothQueue.activeRides.find(
          queueRide => queueRide.rideId.toString() === rideId
        );
        
        if (rideInQueue) {
          queueInfo.currentRideInfo = rideInQueue;
        }
      }
    }

    const rideDetails = {
      ...ride,
      queueInfo
    };

    console.log(`✅ [Admin Ride Details] Retrieved ride details for: ${rideId}`);

    res.status(200).json({
      success: true,
      data: rideDetails
    });

  } catch (error) {
    console.error('❌ [Admin Ride Details] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ride details',
      error: error.message
    });
  }
});

// PUT /admin/rides/:rideId/status - Emergency status update
router.put('/:rideId/status', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status, reason, adminNote } = req.body;

    console.log(`⚡ [Admin Status Update] Updating ride ${rideId} to status: ${status}`);

    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    const oldStatus = ride.status;
    ride.status = status;

    // Add admin action log
    if (!ride.adminActions) {
      ride.adminActions = [];
    }
    
    ride.adminActions.push({
      action: 'status_update',
      oldStatus,
      newStatus: status,
      reason,
      adminNote,
      timestamp: new Date()
    });

    await ride.save();

    // If cancelling, remove from queue
    if (status === 'cancelled' && ride.queueNumber) {
      try {
        const { removeFromQueue } = require('../../utils/queueManager');
        await removeFromQueue(rideId);
        console.log(`🗑️ [Admin Status Update] Removed ride ${rideId} from queue`);
      } catch (queueError) {
        console.error('Error removing from queue:', queueError);
      }
    }

    console.log(`✅ [Admin Status Update] Status updated: ${oldStatus} → ${status}`);
    
    // Notify other admins of status update
    try {
      notifyAdmins('rideStatusUpdated', {
        rideId: ride._id.toString(),
        uniqueRideId: ride.rideId,
        oldStatus,
        newStatus: status,
        reason,
        adminNote,
        userName: ride.userName,
        driverName: ride.driverName,
        pickupLocation: ride.pickupLocation,
        queueNumber: ride.queueNumber,
        updatedAt: new Date()
      });
    } catch (notifyError) {
      console.error('Error notifying admins:', notifyError);
    }

    res.status(200).json({
      success: true,
      message: 'Ride status updated successfully',
      data: {
        rideId,
        oldStatus,
        newStatus: status,
        reason,
        adminNote
      }
    });

  } catch (error) {
    console.error('❌ [Admin Status Update] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ride status',
      error: error.message
    });
  }
});

// GET /admin/rides/analytics/summary - Get ride analytics summary
router.get('/analytics/summary', async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0]
    } = req.query;

    console.log(`📊 [Admin Analytics] Generating summary from ${startDate} to ${endDate}`);

    const dateFilter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      }
    };

    // Date filter for RideHistory (uses timestamps.requested)
    const historyDateFilter = {
      'timestamps.requested': {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      }
    };

    // Get total rides by status from both collections
    const [activeRidesByStatus, historyRidesByStatus] = await Promise.all([
      RideRequest.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      RideHistory.aggregate([
        { $match: historyDateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // Combine status counts
    const ridesByStatus = [...activeRidesByStatus];
    historyRidesByStatus.forEach(historyStatus => {
      const existingStatus = ridesByStatus.find(s => s._id === historyStatus._id);
      if (existingStatus) {
        existingStatus.count += historyStatus.count;
      } else {
        ridesByStatus.push(historyStatus);
      }
    });

    // Get rides by booth from both collections
    const [activeRidesByBooth, historyRidesByBooth] = await Promise.all([
      RideRequest.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$pickupLocation', count: { $sum: 1 } } }
      ]),
      RideHistory.aggregate([
        { $match: historyDateFilter },
        { $group: { _id: '$pickupLocation.boothName', count: { $sum: 1 } } }
      ])
    ]);

    // Combine booth counts
    const combinedRidesByBooth = [...activeRidesByBooth];
    historyRidesByBooth.forEach(historyBooth => {
      const existingBooth = combinedRidesByBooth.find(b => b._id === historyBooth._id);
      if (existingBooth) {
        existingBooth.count += historyBooth.count;
      } else {
        combinedRidesByBooth.push(historyBooth);
      }
    });
    const ridesByBooth = combinedRidesByBooth
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get daily ride counts from both collections
    const [activeDailyRides, historyDailyRides] = await Promise.all([
      RideRequest.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        }
      ]),
      RideHistory.aggregate([
        { $match: historyDateFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamps.requested' } },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Combine daily counts
    const combinedDailyRides = [...activeDailyRides];
    historyDailyRides.forEach(historyDay => {
      const existingDay = combinedDailyRides.find(d => d._id === historyDay._id);
      if (existingDay) {
        existingDay.count += historyDay.count;
      } else {
        combinedDailyRides.push(historyDay);
      }
    });
    const dailyRides = combinedDailyRides.sort((a, b) => a._id.localeCompare(b._id));

    // Calculate average ride duration from both collections
    const [activeAvgDuration, historyAvgDuration] = await Promise.all([
      RideRequest.aggregate([
        { 
          $match: { 
            ...dateFilter,
            status: 'ride_ended',
            rideStartTime: { $exists: true },
            rideEndTime: { $exists: true }
          }
        },
        {
          $addFields: {
            duration: { $subtract: ['$rideEndTime', '$rideStartTime'] }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' },
            count: { $sum: 1 }
          }
        }
      ]),
      RideHistory.aggregate([
        { 
          $match: { 
            ...historyDateFilter,
            status: 'completed',
            'timestamps.rideStarted': { $exists: true },
            'timestamps.rideEnded': { $exists: true }
          }
        },
        {
          $addFields: {
            duration: { $subtract: ['$timestamps.rideEnded', '$timestamps.rideStarted'] }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Combine average durations weighted by count
    let avgDurationMinutes = 0;
    if (activeAvgDuration.length > 0 || historyAvgDuration.length > 0) {
      const activeDuration = activeAvgDuration[0] || { avgDuration: 0, count: 0 };
      const historyDurationData = historyAvgDuration[0] || { avgDuration: 0, count: 0 };
      
      const totalCount = activeDuration.count + historyDurationData.count;
      if (totalCount > 0) {
        const weightedAvg = ((activeDuration.avgDuration * activeDuration.count) + 
                           (historyDurationData.avgDuration * historyDurationData.count)) / totalCount;
        avgDurationMinutes = Math.round(weightedAvg / (1000 * 60));
      }
    }

    const analytics = {
      dateRange: { startDate, endDate },
      ridesByStatus: ridesByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      ridesByBooth,
      dailyRides,
      avgDurationMinutes,
      totalRides: ridesByStatus.reduce((sum, item) => sum + item.count, 0)
    };

    console.log(`✅ [Admin Analytics] Generated summary with ${analytics.totalRides} total rides`);

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ [Admin Analytics] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analytics',
      error: error.message
    });
  }
});

// GET /admin/rides/booths/list - Get list of all booths with ride counts
router.get('/booths/list', async (req, res) => {
  try {
    console.log('🏢 [Admin Booths List] Fetching booth list with ride counts');

    // Get unique booth names from rides
    const boothsFromRides = await RideRequest.aggregate([
      {
        $group: {
          _id: {
            $cond: {
              if: { $type: "$pickupLocation" },
              then: {
                $cond: {
                  if: { $eq: [{ $type: "$pickupLocation" }, "object"] },
                  then: "$pickupLocation.boothName",
                  else: "$pickupLocation"
                }
              },
              else: null
            }
          },
          totalRides: { $sum: 1 },
          lastRide: { $max: '$createdAt' }
        }
      },
      { $match: { _id: { $ne: null, $ne: "" } } },
      { $sort: { totalRides: -1 } }
    ]);

    console.log('🏢 [Admin Booths List] Aggregate results:', boothsFromRides.length, 'booths');
    console.log('🏢 [Admin Booths List] Sample booth data:', boothsFromRides.slice(0, 3).map(b => ({
      id: b._id,
      type: typeof b._id,
      totalRides: b.totalRides
    })));

    // Get all pickup locations
    const allLocations = await PickupLocation.find({}, 'name type subType address').lean();

    // Merge booth data
    const booths = allLocations.map(location => {
      const rideData = boothsFromRides.find(booth => {
        // Add proper type checking and null safety
        if (!booth || !booth._id || typeof booth._id !== 'string') {
          return false;
        }
        
        if (!location || !location.name || typeof location.name !== 'string') {
          return false;
        }
        
        try {
          return location.name.toLowerCase().includes(booth._id.toLowerCase());
        } catch (error) {
          console.error('Error matching booth data:', error, { booth: booth._id, location: location.name });
          return false;
        }
      });

      return {
        name: location.name,
        type: location.type,
        subType: location.subType,
        address: location.address,
        totalRides: rideData ? rideData.totalRides : 0,
        lastRide: rideData ? rideData.lastRide : null,
        hasActiveRides: rideData ? rideData.totalRides > 0 : false
      };
    });

    // Sort by total rides (booths with rides first)
    booths.sort((a, b) => b.totalRides - a.totalRides);

    console.log(`✅ [Admin Booths List] Retrieved ${booths.length} booths`);

    res.status(200).json({
      success: true,
      data: {
        booths,
        totalBooths: booths.length,
        activeBooths: booths.filter(b => b.hasActiveRides).length
      }
    });

  } catch (error) {
    console.error('❌ [Admin Booths List] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booths list',
      error: error.message
    });
  }
});

// GET /admin/rides/missing-driver-info - Get rides with missing driver information
router.get('/missing-driver-info', async (req, res) => {
  try {
    console.log('🔍 [Admin Missing Driver Info] Finding rides with missing driver info');
    
    const ridesWithMissingInfo = await RideRequest.find({
      $or: [
        { driverId: null },
        { driverId: { $exists: false } },
        { driverName: null },
        { driverName: { $exists: false } },
        { driverName: '' },
        { 
          $and: [
            { driverId: { $exists: true, $ne: null } },
            { 
              $or: [
                { driverName: { $exists: false } },
                { driverName: '' },
                { driverPhone: { $exists: false } },
                { driverPhone: '' }
              ]
            }
          ]
        }
      ]
    })
    .populate('userId', 'name email phone')
    .populate('driverId', 'fullName name vehicleNo mobileNo phone rating')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    // Enhance the data with recommendations
    ridesWithMissingInfo.forEach(ride => {
      ride.missingFields = [];
      
      if (!ride.driverId) {
        ride.missingFields.push('driverId');
      } else {
        if (!ride.driverName) {
          ride.missingFields.push('driverName');
          // Suggest from populated driver
          if (ride.driverId && typeof ride.driverId === 'object') {
            ride.suggestedDriverName = ride.driverId.fullName || ride.driverId.name;
          }
        }
        if (!ride.driverPhone) {
          ride.missingFields.push('driverPhone');
          // Suggest from populated driver
          if (ride.driverId && typeof ride.driverId === 'object') {
            ride.suggestedDriverPhone = ride.driverId.mobileNo || ride.driverId.phone;
          }
        }
        if (!ride.driverVehicleNo) {
          ride.missingFields.push('driverVehicleNo');
          if (ride.driverId && typeof ride.driverId === 'object') {
            ride.suggestedDriverVehicleNo = ride.driverId.vehicleNo;
          }
        }
      }
      
      ride.severity = ride.missingFields.includes('driverId') ? 'critical' : 'moderate';
    });

    console.log(`✅ [Admin Missing Driver Info] Found ${ridesWithMissingInfo.length} rides with missing driver info`);

    res.status(200).json({
      success: true,
      data: {
        count: ridesWithMissingInfo.length,
        rides: ridesWithMissingInfo,
        summary: {
          critical: ridesWithMissingInfo.filter(r => r.severity === 'critical').length,
          moderate: ridesWithMissingInfo.filter(r => r.severity === 'moderate').length
        }
      }
    });

  } catch (error) {
    console.error('❌ [Admin Missing Driver Info] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding rides with missing driver info',
      error: error.message
    });
  }
});

module.exports = router;