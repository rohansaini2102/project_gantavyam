// routes/analytics.js
const express = require('express');
const router = express.Router();
const protectUser = require('../middleware/userAuth');
const { protect } = require('../middleware/auth');
const RideLifecycleService = require('../services/rideLifecycle');
const RideHistory = require('../models/RideHistory');
const User = require('../models/User');
const Driver = require('../models/Driver');

// Get user ride analytics
router.get('/user/stats', protectUser, async (req, res) => {
  try {
    console.log('\n=== GET USER ANALYTICS ===');
    console.log('User ID:', req.user.id);
    
    const result = await RideLifecycleService.getUserRideAnalytics(req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.analytics
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user analytics',
      error: error.message
    });
  }
});

// Get user detailed ride history with analytics
router.get('/user/detailed-history', protectUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    console.log('\n=== GET USER DETAILED HISTORY ===');
    console.log('User ID:', userId);
    console.log('Page:', page, 'Limit:', limit, 'Status:', status);
    
    // Build query filter
    let filter = { userId: userId };
    if (status !== 'all') {
      filter.status = status;
    }
    
    // Get ride history with pagination
    const rideHistory = await RideHistory.find(filter)
      .populate('driverId', 'fullName mobileNo vehicleNo rating')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const totalRides = await RideHistory.countDocuments(filter);
    
    // Calculate summary statistics
    const completedRides = await RideHistory.find({ userId: userId, status: 'completed' });
    const analytics = {
      totalRides: totalRides,
      completedRides: completedRides.length,
      cancelledRides: totalRides - completedRides.length,
      totalSpent: completedRides.reduce((sum, ride) => sum + ride.actualFare, 0),
      averageFare: completedRides.length > 0 ? 
        completedRides.reduce((sum, ride) => sum + ride.actualFare, 0) / completedRides.length : 0,
      averageDistance: completedRides.length > 0 ? 
        completedRides.reduce((sum, ride) => sum + ride.distance, 0) / completedRides.length : 0,
      averageRideDuration: completedRides.length > 0 ? 
        completedRides.reduce((sum, ride) => sum + (ride.journeyStats?.rideDuration || 0), 0) / completedRides.length : 0
    };
    
    res.json({
      success: true,
      data: {
        rideHistory: rideHistory,
        analytics: analytics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRides / limit),
          totalRides: totalRides,
          hasNextPage: page < Math.ceil(totalRides / limit),
          hasPrevPage: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting detailed user history:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving detailed ride history',
      error: error.message
    });
  }
});

// Get driver ride analytics
router.get('/driver/stats', protect, async (req, res) => {
  try {
    console.log('\n=== GET DRIVER ANALYTICS ===');
    console.log('Driver ID:', req.driver.id);
    
    const result = await RideLifecycleService.getDriverRideAnalytics(req.driver.id);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.analytics
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error getting driver analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving driver analytics',
      error: error.message
    });
  }
});

// Get driver detailed ride history
router.get('/driver/detailed-history', protect, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    console.log('\n=== GET DRIVER DETAILED HISTORY ===');
    console.log('Driver ID:', driverId);
    
    // Build query filter
    let filter = { driverId: driverId };
    if (status !== 'all') {
      filter.status = status;
    }
    
    // Get ride history with pagination
    const rideHistory = await RideHistory.find(filter)
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const totalRides = await RideHistory.countDocuments(filter);
    
    // Helper function to calculate driver earnings from customer fare
    const calculateDriverEarningsFromCustomerFare = (customerFare) => {
      if (!customerFare || customerFare <= 0) return 0;
      // Reverse calculation: customerFare ≈ driverFare × 1.155 (assuming no night charge)
      const estimatedDriverFare = Math.round(customerFare / 1.155);
      return Math.max(0, estimatedDriverFare);
    };

    // Get driver earnings from each ride
    const getDriverEarnings = (ride) => {
      if (ride.driverFare && ride.driverFare > 0) {
        return ride.driverFare;
      } else if (ride.estimatedFare && ride.estimatedFare > 0) {
        return ride.estimatedFare;
      } else if (ride.actualFare && ride.actualFare > 0) {
        return calculateDriverEarningsFromCustomerFare(ride.actualFare);
      }
      return 0;
    };

    // Map ride history to show driver earnings
    const mappedRideHistory = rideHistory.map(ride => ({
      ...ride.toObject(),
      fare: getDriverEarnings(ride),
      actualFare: getDriverEarnings(ride),
      estimatedFare: getDriverEarnings(ride),
      driverFare: getDriverEarnings(ride),
      // Hide customer-specific data
      gstAmount: undefined,
      commissionAmount: undefined,
      nightChargeAmount: undefined,
      customerFare: undefined
    }));

    // Calculate summary statistics
    const completedRides = await RideHistory.find({ driverId: driverId, status: 'completed' });
    const analytics = {
      totalRides: totalRides,
      completedRides: completedRides.length,
      cancelledRides: totalRides - completedRides.length,
      totalEarnings: completedRides.reduce((sum, ride) => sum + getDriverEarnings(ride), 0),
      averageEarningsPerRide: completedRides.length > 0 ?
        completedRides.reduce((sum, ride) => sum + ride.actualFare, 0) / completedRides.length : 0,
      averageDistance: completedRides.length > 0 ?
        completedRides.reduce((sum, ride) => sum + ride.distance, 0) / completedRides.length : 0,
      averageRideDuration: completedRides.length > 0 ?
        completedRides.reduce((sum, ride) => sum + (ride.journeyStats?.rideDuration || 0), 0) / completedRides.length : 0
    };

    res.json({
      success: true,
      data: {
        rideHistory: mappedRideHistory,
        analytics: analytics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRides / limit),
          totalRides: totalRides,
          hasNextPage: page < Math.ceil(totalRides / limit),
          hasPrevPage: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting detailed driver history:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving detailed ride history',
      error: error.message
    });
  }
});

// Get ride analytics for a specific ride
router.get('/ride/:rideId', protectUser, async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;
    
    console.log('\n=== GET RIDE ANALYTICS ===');
    console.log('Ride ID:', rideId);
    console.log('User ID:', userId);
    
    // Find ride in history
    const ride = await RideHistory.findOne({ 
      $or: [
        { _id: rideId },
        { rideId: rideId }
      ],
      userId: userId 
    }).populate('driverId', 'fullName mobileNo vehicleNo rating');
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found in history'
      });
    }
    
    res.json({
      success: true,
      data: {
        ride: ride,
        journeyStats: ride.journeyStats,
        timeline: ride.timestamps,
        paymentInfo: {
          method: ride.paymentMethod,
          status: ride.paymentStatus,
          actualFare: ride.actualFare,
          estimatedFare: ride.estimatedFare
        },
        ratings: {
          userRating: ride.userRating,
          driverRating: ride.driverRatingForUser
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting ride analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving ride analytics',
      error: error.message
    });
  }
});

// Get system-wide analytics (admin only)
router.get('/system/overview', async (req, res) => {
  try {
    console.log('\n=== GET SYSTEM ANALYTICS ===');
    
    // Get basic counts
    const totalUsers = await User.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const totalRides = await RideHistory.countDocuments();
    const completedRides = await RideHistory.countDocuments({ status: 'completed' });
    const cancelledRides = await RideHistory.countDocuments({ status: 'cancelled' });
    
    // Get revenue data
    const completedRideData = await RideHistory.find({ status: 'completed' });
    const totalRevenue = completedRideData.reduce((sum, ride) => sum + ride.actualFare, 0);
    
    // Get today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayRides = await RideHistory.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const todayRevenue = await RideHistory.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$actualFare' }
        }
      }
    ]);
    
    // Get popular metro stations
    const popularStations = await RideHistory.aggregate([
      {
        $group: {
          _id: '$pickupLocation.boothName',
          rideCount: { $sum: 1 }
        }
      },
      { $sort: { rideCount: -1 } },
      { $limit: 5 }
    ]);
    
    const analytics = {
      overview: {
        totalUsers,
        totalDrivers,
        totalRides,
        completedRides,
        cancelledRides,
        completionRate: totalRides > 0 ? (completedRides / totalRides * 100).toFixed(2) + '%' : '0%',
        totalRevenue: totalRevenue,
        averageRideValue: completedRides > 0 ? (totalRevenue / completedRides).toFixed(2) : 0
      },
      today: {
        rides: todayRides,
        revenue: todayRevenue[0]?.totalRevenue || 0
      },
      popularStations: popularStations.map(station => ({
        stationName: station._id,
        rideCount: station.rideCount
      }))
    };
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('❌ Error getting system analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving system analytics',
      error: error.message
    });
  }
});

module.exports = router;