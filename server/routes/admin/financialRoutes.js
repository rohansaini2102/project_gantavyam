const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const RideHistory = require('../../models/RideHistory');
const { adminAuth } = require('../../middleware/adminAuth');

// @desc    Get financial summary
// @route   GET /api/admin/financial/summary
// @access  Private (Admin only)
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, vehicleType, status } = req.query;

    console.log('📊 [Financial API] Getting financial summary');
    console.log('Filters:', { startDate, endDate, vehicleType, status });

    // Build query filter
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    if (vehicleType && vehicleType !== 'all') {
      filter.vehicleType = vehicleType;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    // Get rides from both RideRequest and RideHistory
    const [activeRides, historicalRides] = await Promise.all([
      RideRequest.find(filter),
      RideHistory.find(filter)
    ]);

    const allRides = [...activeRides, ...historicalRides];

    // Calculate financial metrics
    let financialSummary = {
      totalRevenue: 0,
      driverEarnings: 0,
      platformRevenue: 0,
      totalCommission: 0,
      totalGST: 0,
      totalNightCharges: 0,
      totalRides: allRides.length,
      completedRides: 0,
      cancelledRides: 0,
      pendingCollections: 0,
      collectedAmount: 0,
      averageFare: 0,
      averageDistance: 0
    };

    // Process each ride
    allRides.forEach(ride => {
      const driverFare = ride.driverFare || ride.fare || 0;
      const customerFare = ride.customerFare || ride.estimatedFare || 0;
      const commission = ride.commissionAmount || Math.round(driverFare * 0.1);
      const gst = ride.gstAmount || Math.round((driverFare + commission) * 0.05);
      const nightCharge = ride.nightChargeAmount || 0;

      financialSummary.totalRevenue += customerFare;
      financialSummary.driverEarnings += driverFare;
      financialSummary.totalCommission += commission;
      financialSummary.totalGST += gst;
      financialSummary.totalNightCharges += nightCharge;
      financialSummary.platformRevenue += (commission + gst + nightCharge);

      if (ride.distance) {
        financialSummary.averageDistance += ride.distance;
      }

      if (ride.status === 'completed') {
        financialSummary.completedRides++;
        if (ride.paymentStatus === 'collected') {
          financialSummary.collectedAmount += customerFare;
        } else {
          financialSummary.pendingCollections += customerFare;
        }
      } else if (ride.status === 'cancelled') {
        financialSummary.cancelledRides++;
      }
    });

    // Calculate averages
    if (financialSummary.totalRides > 0) {
      financialSummary.averageFare = Math.round(financialSummary.totalRevenue / financialSummary.totalRides);
      financialSummary.averageDistance = Math.round(financialSummary.averageDistance / financialSummary.totalRides * 10) / 10;
    }

    // Calculate completion rate
    financialSummary.completionRate = financialSummary.totalRides > 0
      ? Math.round(financialSummary.completedRides / financialSummary.totalRides * 100)
      : 0;

    console.log(`✅ Financial summary calculated for ${allRides.length} rides`);

    res.json({
      success: true,
      data: financialSummary,
      filters: { startDate, endDate, vehicleType, status },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting financial summary',
      error: error.message
    });
  }
});

// @desc    Get revenue trends
// @route   GET /api/admin/financial/trends
// @access  Private (Admin only)
router.get('/trends', adminAuth, async (req, res) => {
  try {
    const { period = 'week', groupBy = 'day' } = req.query;

    console.log('📈 [Financial API] Getting revenue trends');
    console.log('Parameters:', { period, groupBy });

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Aggregation pipeline
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: now },
          status: 'completed'
        }
      }
    ];

    // Add grouping stage based on groupBy parameter
    let groupStage = {};
    if (groupBy === 'hour') {
      groupStage = {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          revenue: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          driverEarnings: { $sum: { $ifNull: ['$driverFare', '$fare'] } },
          platformRevenue: {
            $sum: {
              $add: [
                { $ifNull: ['$commissionAmount', 0] },
                { $ifNull: ['$gstAmount', 0] },
                { $ifNull: ['$nightChargeAmount', 0] }
              ]
            }
          },
          rides: { $sum: 1 },
          avgFare: { $avg: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      };
    } else if (groupBy === 'day') {
      groupStage = {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          driverEarnings: { $sum: { $ifNull: ['$driverFare', '$fare'] } },
          platformRevenue: {
            $sum: {
              $add: [
                { $ifNull: ['$commissionAmount', 0] },
                { $ifNull: ['$gstAmount', 0] },
                { $ifNull: ['$nightChargeAmount', 0] }
              ]
            }
          },
          rides: { $sum: 1 },
          avgFare: { $avg: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      };
    } else if (groupBy === 'week') {
      groupStage = {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          },
          revenue: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          driverEarnings: { $sum: { $ifNull: ['$driverFare', '$fare'] } },
          platformRevenue: {
            $sum: {
              $add: [
                { $ifNull: ['$commissionAmount', 0] },
                { $ifNull: ['$gstAmount', 0] },
                { $ifNull: ['$nightChargeAmount', 0] }
              ]
            }
          },
          rides: { $sum: 1 },
          avgFare: { $avg: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      };
    } else {
      groupStage = {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          driverEarnings: { $sum: { $ifNull: ['$driverFare', '$fare'] } },
          platformRevenue: {
            $sum: {
              $add: [
                { $ifNull: ['$commissionAmount', 0] },
                { $ifNull: ['$gstAmount', 0] },
                { $ifNull: ['$nightChargeAmount', 0] }
              ]
            }
          },
          rides: { $sum: 1 },
          avgFare: { $avg: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      };
    }

    pipeline.push(groupStage);
    pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } });

    // Execute aggregation on both collections
    const [activeTrends, historicalTrends] = await Promise.all([
      RideRequest.aggregate(pipeline),
      RideHistory.aggregate(pipeline)
    ]);

    // Combine and format results
    const trendData = [...activeTrends, ...historicalTrends];

    // Format the data for easier consumption
    const formattedData = trendData.map(item => {
      let dateLabel = '';
      if (groupBy === 'hour') {
        dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')} ${String(item._id.hour).padStart(2, '0')}:00`;
      } else if (groupBy === 'day') {
        dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        dateLabel = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
      } else {
        dateLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      }

      return {
        date: dateLabel,
        revenue: Math.round(item.revenue),
        driverEarnings: Math.round(item.driverEarnings),
        platformRevenue: Math.round(item.platformRevenue),
        rides: item.rides,
        averageFare: Math.round(item.avgFare)
      };
    });

    console.log(`✅ Revenue trends calculated: ${formattedData.length} data points`);

    res.json({
      success: true,
      data: formattedData,
      period,
      groupBy,
      dateRange: { startDate, endDate: now }
    });

  } catch (error) {
    console.error('❌ Error getting revenue trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting revenue trends',
      error: error.message
    });
  }
});

// @desc    Get payment analytics
// @route   GET /api/admin/financial/payment-analytics
// @access  Private (Admin only)
router.get('/payment-analytics', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('💳 [Financial API] Getting payment analytics');

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get payment method distribution
    const paymentMethodPipeline = [
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      }
    ];

    // Get payment status distribution
    const paymentStatusPipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      }
    ];

    // Execute aggregations
    const [paymentMethods, paymentStatuses] = await Promise.all([
      RideRequest.aggregate(paymentMethodPipeline),
      RideRequest.aggregate(paymentStatusPipeline)
    ]);

    // Get collection timeline
    const collectionTimeline = await RideRequest.aggregate([
      {
        $match: {
          ...dateFilter,
          status: 'completed',
          paymentStatus: 'collected'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentCollectedAt' },
            month: { $month: '$paymentCollectedAt' },
            day: { $dayOfMonth: '$paymentCollectedAt' }
          },
          collected: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Format payment method data
    const paymentMethodData = {};
    paymentMethods.forEach(item => {
      const method = item._id || 'cash';
      paymentMethodData[method] = {
        count: item.count,
        amount: item.totalAmount,
        percentage: 0 // Will calculate after
      };
    });

    // Calculate percentages
    const totalPayments = Object.values(paymentMethodData).reduce((sum, item) => sum + item.count, 0);
    Object.keys(paymentMethodData).forEach(method => {
      paymentMethodData[method].percentage = totalPayments > 0
        ? Math.round(paymentMethodData[method].count / totalPayments * 100)
        : 0;
    });

    // Format payment status data
    const paymentStatusData = {};
    paymentStatuses.forEach(item => {
      const status = item._id || 'pending';
      paymentStatusData[status] = {
        count: item.count,
        amount: item.totalAmount
      };
    });

    // Format collection timeline
    const timeline = collectionTimeline.map(item => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      collected: item.collected,
      count: item.count
    }));

    console.log(`✅ Payment analytics calculated`);

    res.json({
      success: true,
      data: {
        paymentMethods: paymentMethodData,
        paymentStatus: paymentStatusData,
        collectionTimeline: timeline,
        summary: {
          totalCollected: paymentStatusData.collected?.amount || 0,
          totalPending: paymentStatusData.pending?.amount || 0,
          collectionRate: totalPayments > 0
            ? Math.round((paymentStatusData.collected?.count || 0) / totalPayments * 100)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting payment analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting payment analytics',
      error: error.message
    });
  }
});

// @desc    Get top routes by revenue
// @route   GET /api/admin/financial/top-routes
// @access  Private (Admin only)
router.get('/top-routes', adminAuth, async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    console.log('🛣️ [Financial API] Getting top routes by revenue');

    // Build date filter
    const dateFilter = { status: 'completed' };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: {
            pickup: '$pickupLocation.boothName',
            destination: '$destination'
          },
          totalRevenue: { $sum: { $ifNull: ['$customerFare', '$estimatedFare'] } },
          rideCount: { $sum: 1 },
          avgDistance: { $avg: '$distance' },
          avgFare: { $avg: { $ifNull: ['$customerFare', '$estimatedFare'] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ];

    const topRoutes = await RideRequest.aggregate(pipeline);

    // Format the data
    const formattedRoutes = topRoutes.map((route, index) => ({
      rank: index + 1,
      route: `${route._id.pickup || 'Unknown'} → ${route._id.destination || 'Unknown'}`,
      pickup: route._id.pickup || 'Unknown',
      destination: route._id.destination || 'Unknown',
      revenue: Math.round(route.totalRevenue),
      rides: route.rideCount,
      avgDistance: Math.round(route.avgDistance * 10) / 10,
      avgFare: Math.round(route.avgFare)
    }));

    console.log(`✅ Top ${formattedRoutes.length} routes calculated`);

    res.json({
      success: true,
      data: formattedRoutes
    });

  } catch (error) {
    console.error('❌ Error getting top routes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting top routes',
      error: error.message
    });
  }
});

// @desc    Export financial report
// @route   GET /api/admin/financial/export
// @access  Private (Admin only)
router.get('/export', adminAuth, async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    console.log('📥 [Financial API] Exporting financial report');

    // Build query filter
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get all rides
    const rides = await RideRequest.find(filter)
      .populate('userId', 'name mobileNo')
      .populate('driverId', 'fullName mobileNo vehicleNo')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Ride ID,Date,Time,Customer,Driver,Vehicle Type,Distance,Base Fare,Commission,GST,Night Charge,Customer Total,Payment Status,Ride Status\n';

      rides.forEach(ride => {
        const date = new Date(ride.createdAt);
        const driverFare = ride.driverFare || ride.fare || 0;
        const commission = ride.commissionAmount || 0;
        const gst = ride.gstAmount || 0;
        const nightCharge = ride.nightChargeAmount || 0;
        const customerTotal = ride.customerFare || ride.estimatedFare || 0;

        csv += `${ride.rideId || ride._id},${date.toLocaleDateString()},${date.toLocaleTimeString()},${ride.userId?.name || 'N/A'},${ride.driverId?.fullName || 'N/A'},${ride.vehicleType || 'N/A'},${ride.distance || 0},${driverFare},${commission},${gst},${nightCharge},${customerTotal},${ride.paymentStatus || 'pending'},${ride.status}\n`;
      });

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename=financial-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);

    } else {
      // Return JSON format
      const reportData = rides.map(ride => ({
        rideId: ride.rideId || ride._id,
        date: ride.createdAt,
        customer: ride.userId?.name || 'N/A',
        driver: ride.driverId?.fullName || 'N/A',
        vehicleType: ride.vehicleType,
        distance: ride.distance,
        driverFare: ride.driverFare || ride.fare || 0,
        commission: ride.commissionAmount || 0,
        gst: ride.gstAmount || 0,
        nightCharge: ride.nightChargeAmount || 0,
        customerTotal: ride.customerFare || ride.estimatedFare || 0,
        paymentStatus: ride.paymentStatus,
        rideStatus: ride.status
      }));

      res.json({
        success: true,
        data: reportData,
        count: reportData.length,
        dateRange: { startDate, endDate }
      });
    }

  } catch (error) {
    console.error('❌ Error exporting financial report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting financial report',
      error: error.message
    });
  }
});

module.exports = router;