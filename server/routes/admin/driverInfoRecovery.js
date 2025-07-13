const express = require('express');
const router = express.Router();
const DriverInfoRecovery = require('../../utils/driverInfoRecovery');
const { adminProtect } = require('../../middleware/auth');

// Apply admin protection to all routes
router.use(adminProtect);

// GET /admin/driver-recovery/stats - Get recovery statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 [Admin Driver Recovery] Getting recovery stats');
    
    const stats = await DriverInfoRecovery.getRecoveryStats();
    
    console.log('✅ [Admin Driver Recovery] Stats retrieved:', stats);
    
    res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ [Admin Driver Recovery] Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recovery statistics',
      error: error.message
    });
  }
});

// GET /admin/driver-recovery/missing - Get rides with missing driver info
router.get('/missing', async (req, res) => {
  try {
    console.log('🔍 [Admin Driver Recovery] Finding rides with missing driver info');
    
    const ridesWithMissingInfo = await DriverInfoRecovery.findRidesWithMissingDriverInfo();
    
    console.log(`✅ [Admin Driver Recovery] Found ${ridesWithMissingInfo.length} rides with missing info`);
    
    res.status(200).json({
      success: true,
      data: {
        count: ridesWithMissingInfo.length,
        rides: ridesWithMissingInfo
      }
    });
    
  } catch (error) {
    console.error('❌ [Admin Driver Recovery] Error finding missing rides:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding rides with missing driver info',
      error: error.message
    });
  }
});

// POST /admin/driver-recovery/dry-run - Run recovery process in dry-run mode
router.post('/dry-run', async (req, res) => {
  try {
    console.log('🧪 [Admin Driver Recovery] Running dry-run recovery process');
    
    const results = await DriverInfoRecovery.runRecoveryProcess(true);
    
    console.log('✅ [Admin Driver Recovery] Dry-run completed:', results);
    
    res.status(200).json({
      success: true,
      message: 'Dry-run recovery process completed',
      data: results
    });
    
  } catch (error) {
    console.error('❌ [Admin Driver Recovery] Error in dry-run:', error);
    res.status(500).json({
      success: false,
      message: 'Error running dry-run recovery',
      error: error.message
    });
  }
});

// POST /admin/driver-recovery/execute - Execute actual recovery process
router.post('/execute', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (!confirm) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Set confirm: true in request body.'
      });
    }
    
    console.log('🔧 [Admin Driver Recovery] Executing recovery process');
    console.log('Admin ID:', req.admin?.id);
    
    const results = await DriverInfoRecovery.runRecoveryProcess(false);
    
    console.log('✅ [Admin Driver Recovery] Recovery process completed:', results);
    
    res.status(200).json({
      success: true,
      message: 'Driver info recovery process completed successfully',
      data: results
    });
    
  } catch (error) {
    console.error('❌ [Admin Driver Recovery] Error in recovery execution:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing recovery process',
      error: error.message
    });
  }
});

// POST /admin/driver-recovery/recover-single - Recover driver info for a single ride
router.post('/recover-single', async (req, res) => {
  try {
    const { rideHistoryId } = req.body;
    
    if (!rideHistoryId) {
      return res.status(400).json({
        success: false,
        message: 'rideHistoryId is required'
      });
    }
    
    console.log('🔧 [Admin Driver Recovery] Recovering single ride:', rideHistoryId);
    
    const RideHistory = require('../../models/RideHistory');
    const rideHistory = await RideHistory.findById(rideHistoryId);
    
    if (!rideHistory) {
      return res.status(404).json({
        success: false,
        message: 'Ride history not found'
      });
    }
    
    const recovery = await DriverInfoRecovery.recoverDriverInfo(rideHistory);
    
    if (recovery.success) {
      const updated = await DriverInfoRecovery.updateRideHistoryWithDriverInfo(
        rideHistoryId,
        recovery.driverInfo,
        recovery.source
      );
      
      if (updated) {
        console.log('✅ [Admin Driver Recovery] Single ride recovery successful');
        res.status(200).json({
          success: true,
          message: 'Driver info recovered successfully',
          data: {
            source: recovery.source,
            driverInfo: recovery.driverInfo
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update ride history with recovered info'
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: 'Could not recover driver information for this ride'
      });
    }
    
  } catch (error) {
    console.error('❌ [Admin Driver Recovery] Error in single recovery:', error);
    res.status(500).json({
      success: false,
      message: 'Error recovering driver info for single ride',
      error: error.message
    });
  }
});

module.exports = router;