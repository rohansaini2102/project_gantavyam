const mongoose = require('mongoose');

// Connect to database and check drivers
const checkDrivers = async () => {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect('mongodb://localhost:27017/gantavyam');
    console.log('✅ Connected to database');
    
    // Import Driver model
    const Driver = require('./server/models/Driver');
    
    // Check total drivers
    const totalDrivers = await Driver.countDocuments();
    console.log(`📊 Total drivers in database: ${totalDrivers}`);
    
    // Check online drivers
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    console.log(`📊 Online drivers: ${onlineDrivers}`);
    
    // List all drivers with their status
    const allDrivers = await Driver.find({})
      .select('fullName mobileNo vehicleType isOnline currentMetroBooth')
      .limit(10);
    
    console.log('📋 Driver details:');
    allDrivers.forEach((driver, index) => {
      console.log(`  ${index + 1}. ${driver.fullName} (${driver.mobileNo})`);
      console.log(`     Vehicle: ${driver.vehicleType}, Online: ${driver.isOnline ? '✅' : '❌'}`);
      console.log(`     Current Booth: ${driver.currentMetroBooth || 'Not set'}`);
      console.log('');
    });
    
    // Check drivers with vehicle type 'auto' (matching our test)
    const autoDrivers = await Driver.find({ vehicleType: 'auto' })
      .select('fullName mobileNo isOnline currentMetroBooth');
    
    console.log(`🚗 Auto drivers: ${autoDrivers.length}`);
    autoDrivers.forEach((driver, index) => {
      console.log(`  ${index + 1}. ${driver.fullName} - Online: ${driver.isOnline ? '✅' : '❌'} - Booth: ${driver.currentMetroBooth || 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
};

checkDrivers();