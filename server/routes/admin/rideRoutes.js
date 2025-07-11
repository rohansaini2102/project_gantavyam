const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
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
        { 'pickupLocation.boothName': booth }
      ];
    }
    
    // Filter by status if specified
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Filter by date range if specified
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object with priority for active rides
    let sort = {};
    
    // Define status priority: assigned first, then pending, in progress, completed, cancelled
    const statusPriority = {
      'driver_assigned': 1,
      'pending': 2,
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

    console.log('🔍 [Admin Rides] Filter:', filter);
    console.log('🔍 [Admin Rides] Sort:', sort);

    // Use aggregation for custom sorting with status priority and population
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "driver_assigned"] }, then: 1 },
                { case: { $eq: ["$status", "pending"] }, then: 2 },
                { case: { $eq: ["$status", "ride_started"] }, then: 3 },
                { case: { $eq: ["$status", "ride_ended"] }, then: 4 },
                { case: { $eq: ["$status", "completed"] }, then: 5 },
                { case: { $eq: ["$status", "cancelled"] }, then: 6 }
              ],
              default: 7
            }
          },
          // Handle both createdAt and timestamp fields
          sortDate: {
            $ifNull: ["$createdAt", "$timestamp"]
          }
        }
      },
      {
        $sort: {
          statusPriority: 1,
          sortDate: sortOrder === 'desc' ? -1 : 1
        }
      },
      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
          pipeline: [
            { $project: { name: 1, email: 1, phone: 1 } }
          ]
        }
      },
      // Lookup driver information
      {
        $lookup: {
          from: 'drivers',
          localField: 'driverId',
          foreignField: '_id',
          as: 'driverInfo',
          pipeline: [
            { $project: { name: 1, vehicleNumber: 1, phone: 1, vehicleNo: 1 } }
          ]
        }
      },
      // Add populated fields back to main document
      {
        $addFields: {
          userId: { $arrayElemAt: ['$userInfo', 0] },
          driverId: { $arrayElemAt: ['$driverInfo', 0] }
        }
      },
      // Remove temporary lookup arrays
      {
        $unset: ['userInfo', 'driverInfo']
      },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) }
    ];

    const rides = await RideRequest.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await RideRequest.countDocuments(filter);

    // Enrich rides with booth queue information and normalize data
    const enrichedRides = await Promise.all(rides.map(async (ride) => {
      try {
        // Ensure createdAt field exists for old records
        if (!ride.createdAt && ride.timestamp) {
          ride.createdAt = ride.timestamp;
        }
        
        // Normalize pickupLocation to string (extract boothName if object)
        let boothName = ride.pickupLocation;
        if (typeof ride.pickupLocation === 'object' && ride.pickupLocation?.boothName) {
          boothName = ride.pickupLocation.boothName;
        }
        
        // Update ride with normalized booth name
        ride.pickupLocation = boothName;

        // Get booth queue info if ride has queue data
        if (ride.queueNumber && boothName) {
          const today = new Date().toISOString().split('T')[0];
          const boothQueue = await BoothQueue.findOne({
            boothName: boothName,
            date: today
          });

          if (boothQueue) {
            const queueInfo = boothQueue.getQueueStatus();
            ride.boothQueueInfo = {
              totalToday: queueInfo.totalToday,
              currentlyServing: queueInfo.currentlyServing,
              queuedCount: queueInfo.queuedCount,
              estimatedWaitTime: queueInfo.estimatedWaitTime
            };
          }
        }

        return ride;
      } catch (error) {
        console.error('Error enriching ride data:', error);
        return ride;
      }
    }));

    console.log(`✅ [Admin Rides] Retrieved ${enrichedRides.length} rides out of ${totalCount} total`);
    console.log(`✅ [Admin Rides] Sample ride data:`, enrichedRides.slice(0, 2).map(r => ({
      id: r._id,
      status: r.status,
      statusPriority: r.statusPriority,
      pickupLocation: r.pickupLocation,
      userId: r.userId ? r.userId.name : 'No user',
      driverId: r.driverId ? (r.driverId.name || r.driverId) : 'No driver',
      queueNumber: r.queueNumber,
      createdAt: r.createdAt,
      timestamp: r.timestamp,
      sortDate: r.sortDate,
      hasUserInfo: !!r.userId,
      hasDriverInfo: !!r.driverId
    })));

    res.status(200).json({
      success: true,
      data: {
        rides: enrichedRides,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + enrichedRides.length < totalCount
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
      .populate('driverId', 'name vehicleNumber phone')
      .sort({ createdAt: -1 })
      .lean();

    // Normalize pickupLocation in booth rides
    rides.forEach(ride => {
      if (typeof ride.pickupLocation === 'object' && ride.pickupLocation?.boothName) {
        ride.pickupLocation = ride.pickupLocation.boothName;
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

    const ride = await RideRequest.findById(rideId)
      .populate('userId', 'name email phone createdAt')
      .populate('driverId', 'name vehicleNumber phone rating totalRides')
      .lean();

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

    // Get total rides by status
    const ridesByStatus = await RideRequest.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get rides by booth
    const ridesByBooth = await RideRequest.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$pickupLocation', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get daily ride counts
    const dailyRides = await RideRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calculate average ride duration (for completed rides)
    const avgDuration = await RideRequest.aggregate([
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
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    const analytics = {
      dateRange: { startDate, endDate },
      ridesByStatus: ridesByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      ridesByBooth,
      dailyRides,
      avgDurationMinutes: avgDuration.length > 0 ? Math.round(avgDuration[0].avgDuration / (1000 * 60)) : 0,
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

module.exports = router;