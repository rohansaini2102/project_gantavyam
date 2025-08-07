const express = require('express');
const router = express.Router();
const FareConfig = require('../../models/FareConfig');
const { adminProtect } = require('../../middleware/auth');
const { calculateFare, calculateDistance } = require('../../utils/fareCalculator');

// Get current fare configuration
router.get('/fare-config', adminProtect, async (req, res) => {
  try {
    const config = await FareConfig.getActiveConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error fetching fare config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fare configuration',
      error: error.message
    });
  }
});

// Update vehicle-specific pricing
router.put('/fare-config/vehicle/:vehicleType', adminProtect, async (req, res) => {
  try {
    const { vehicleType } = req.params;
    const { baseFare, perKmRate, minimumFare, waitingChargePerMin } = req.body;
    
    // Validate vehicle type
    if (!['bike', 'auto', 'car'].includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type'
      });
    }
    
    // Validate values
    if (baseFare < 0 || perKmRate < 0 || minimumFare < 0 || waitingChargePerMin < 0) {
      return res.status(400).json({
        success: false,
        message: 'All values must be positive'
      });
    }
    
    // Get current config
    const currentConfig = await FareConfig.getActiveConfig();
    
    // Create new config with updated vehicle pricing
    const newConfig = {
      vehicleConfigs: {
        ...currentConfig.vehicleConfigs,
        [vehicleType]: {
          baseFare,
          perKmRate,
          minimumFare,
          waitingChargePerMin
        }
      },
      surgeTimes: currentConfig.surgeTimes,
      dynamicPricing: currentConfig.dynamicPricing,
      updatedBy: req.admin._id,
      updatedByName: req.admin.name,
      notes: `Updated ${vehicleType} pricing`,
      isActive: true
    };
    
    // Deactivate current config
    await FareConfig.updateOne(
      { _id: currentConfig._id },
      { isActive: false }
    );
    
    // Create new config
    const savedConfig = await FareConfig.create(newConfig);
    
    res.json({
      success: true,
      message: `${vehicleType} pricing updated successfully`,
      config: savedConfig
    });
  } catch (error) {
    console.error('Error updating vehicle pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle pricing',
      error: error.message
    });
  }
});

// Update all vehicle pricing at once
router.put('/fare-config/vehicles', adminProtect, async (req, res) => {
  try {
    const { vehicleConfigs } = req.body;
    
    // Validate all vehicle types are present
    if (!vehicleConfigs.bike || !vehicleConfigs.auto || !vehicleConfigs.car) {
      return res.status(400).json({
        success: false,
        message: 'All vehicle types must be provided'
      });
    }
    
    // Get current config
    const currentConfig = await FareConfig.getActiveConfig();
    
    // Create new config
    const newConfig = {
      vehicleConfigs,
      surgeTimes: currentConfig.surgeTimes,
      dynamicPricing: currentConfig.dynamicPricing,
      updatedBy: req.admin._id,
      updatedByName: req.admin.name,
      notes: 'Updated all vehicle pricing',
      isActive: true
    };
    
    // Deactivate current config
    await FareConfig.updateOne(
      { _id: currentConfig._id },
      { isActive: false }
    );
    
    // Create new config
    const savedConfig = await FareConfig.create(newConfig);
    
    res.json({
      success: true,
      message: 'All vehicle pricing updated successfully',
      config: savedConfig
    });
  } catch (error) {
    console.error('Error updating vehicles pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicles pricing',
      error: error.message
    });
  }
});

// Update surge pricing rules
router.put('/fare-config/surge', adminProtect, async (req, res) => {
  try {
    const { surgeTimes } = req.body;
    
    if (!Array.isArray(surgeTimes)) {
      return res.status(400).json({
        success: false,
        message: 'Surge times must be an array'
      });
    }
    
    // Validate surge times
    for (const surge of surgeTimes) {
      if (surge.factor < 1.0 || surge.factor > 3.0) {
        return res.status(400).json({
          success: false,
          message: 'Surge factor must be between 1.0 and 3.0'
        });
      }
    }
    
    // Get current config
    const currentConfig = await FareConfig.getActiveConfig();
    
    // Create new config
    const newConfig = {
      vehicleConfigs: currentConfig.vehicleConfigs,
      surgeTimes,
      dynamicPricing: currentConfig.dynamicPricing,
      updatedBy: req.admin._id,
      updatedByName: req.admin.name,
      notes: 'Updated surge pricing rules',
      isActive: true
    };
    
    // Deactivate current config
    await FareConfig.updateOne(
      { _id: currentConfig._id },
      { isActive: false }
    );
    
    // Create new config
    const savedConfig = await FareConfig.create(newConfig);
    
    res.json({
      success: true,
      message: 'Surge pricing updated successfully',
      config: savedConfig
    });
  } catch (error) {
    console.error('Error updating surge pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update surge pricing',
      error: error.message
    });
  }
});

// Update dynamic pricing thresholds
router.put('/fare-config/dynamic', adminProtect, async (req, res) => {
  try {
    const { dynamicPricing } = req.body;
    
    if (!Array.isArray(dynamicPricing)) {
      return res.status(400).json({
        success: false,
        message: 'Dynamic pricing must be an array'
      });
    }
    
    // Validate dynamic pricing
    for (const pricing of dynamicPricing) {
      if (pricing.factor < 1.0 || pricing.factor > 3.0) {
        return res.status(400).json({
          success: false,
          message: 'Dynamic pricing factor must be between 1.0 and 3.0'
        });
      }
    }
    
    // Get current config
    const currentConfig = await FareConfig.getActiveConfig();
    
    // Create new config
    const newConfig = {
      vehicleConfigs: currentConfig.vehicleConfigs,
      surgeTimes: currentConfig.surgeTimes,
      dynamicPricing,
      updatedBy: req.admin._id,
      updatedByName: req.admin.name,
      notes: 'Updated dynamic pricing thresholds',
      isActive: true
    };
    
    // Deactivate current config
    await FareConfig.updateOne(
      { _id: currentConfig._id },
      { isActive: false }
    );
    
    // Create new config
    const savedConfig = await FareConfig.create(newConfig);
    
    res.json({
      success: true,
      message: 'Dynamic pricing updated successfully',
      config: savedConfig
    });
  } catch (error) {
    console.error('Error updating dynamic pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dynamic pricing',
      error: error.message
    });
  }
});

// Get fare config history
router.get('/fare-config/history', adminProtect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const history = await FareConfig.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .populate('updatedBy', 'name email');
    
    const total = await FareConfig.countDocuments();
    
    res.json({
      success: true,
      history,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching fare history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fare history',
      error: error.message
    });
  }
});

// Simulate fare calculation with new config
router.post('/fare-config/simulate', adminProtect, async (req, res) => {
  try {
    const { 
      vehicleType, 
      distance, 
      waitingTime = 0,
      testConfig = null,
      pickupStation = null
    } = req.body;
    
    // Use test config or current config
    const config = testConfig || await FareConfig.getActiveConfig();
    
    // Calculate base fare
    const vehicleConfig = config.vehicleConfigs[vehicleType];
    if (!vehicleConfig) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type'
      });
    }
    
    const baseFare = vehicleConfig.baseFare;
    const distanceFare = distance * vehicleConfig.perKmRate;
    const waitingCharges = waitingTime * vehicleConfig.waitingChargePerMin;
    
    let totalFare = baseFare + distanceFare + waitingCharges;
    totalFare = Math.max(totalFare, vehicleConfig.minimumFare);
    
    // Apply surge if applicable
    let surgeFactor = 1.0;
    const currentHour = new Date().getHours();
    
    for (const surge of config.surgeTimes) {
      if (!surge.isActive) continue;
      
      if (surge.startHour <= surge.endHour) {
        if (currentHour >= surge.startHour && currentHour <= surge.endHour) {
          surgeFactor = surge.factor;
          break;
        }
      } else {
        // Handles overnight periods
        if (currentHour >= surge.startHour || currentHour <= surge.endHour) {
          surgeFactor = surge.factor;
          break;
        }
      }
    }
    
    totalFare = totalFare * surgeFactor;
    
    // For demo, simulate dynamic pricing
    let dynamicFactor = 1.0;
    if (pickupStation) {
      // Simulate demand/supply ratio
      const simulatedRatio = Math.random() * 4; // Random ratio for simulation
      
      for (const pricing of config.dynamicPricing) {
        if (pricing.maxRatio === null || pricing.maxRatio === undefined) {
          if (simulatedRatio >= pricing.minRatio) {
            dynamicFactor = pricing.factor;
          }
        } else {
          if (simulatedRatio >= pricing.minRatio && simulatedRatio < pricing.maxRatio) {
            dynamicFactor = pricing.factor;
            break;
          }
        }
      }
    }
    
    totalFare = Math.round(totalFare * dynamicFactor);
    
    res.json({
      success: true,
      simulation: {
        vehicleType,
        distance,
        waitingTime,
        baseFare,
        distanceFare: Math.round(distanceFare),
        waitingCharges: Math.round(waitingCharges),
        minimumFare: vehicleConfig.minimumFare,
        surgeFactor,
        dynamicFactor,
        totalFare,
        breakdown: {
          beforeSurge: Math.round(baseFare + distanceFare + waitingCharges),
          afterSurge: Math.round((baseFare + distanceFare + waitingCharges) * surgeFactor),
          final: totalFare
        }
      }
    });
  } catch (error) {
    console.error('Error simulating fare:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate fare',
      error: error.message
    });
  }
});

// Restore a previous config
router.post('/fare-config/restore/:configId', adminProtect, async (req, res) => {
  try {
    const { configId } = req.params;
    
    // Find the config to restore
    const configToRestore = await FareConfig.findById(configId);
    if (!configToRestore) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    // Deactivate all current configs
    await FareConfig.updateMany(
      { isActive: true },
      { isActive: false }
    );
    
    // Create new config based on the one to restore
    const newConfig = {
      vehicleConfigs: configToRestore.vehicleConfigs,
      surgeTimes: configToRestore.surgeTimes,
      dynamicPricing: configToRestore.dynamicPricing,
      updatedBy: req.admin._id,
      updatedByName: req.admin.name,
      notes: `Restored from version ${configToRestore.version}`,
      isActive: true
    };
    
    const savedConfig = await FareConfig.create(newConfig);
    
    res.json({
      success: true,
      message: 'Configuration restored successfully',
      config: savedConfig
    });
  } catch (error) {
    console.error('Error restoring config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore configuration',
      error: error.message
    });
  }
});

module.exports = router;