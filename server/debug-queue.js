const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const Driver = require('./models/Driver');

    console.log('🔍 Current Driver Queue State:');
    console.log('================================');

    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).select('fullName queuePosition queueEntryTime lastActiveTime isOnline').sort({ queuePosition: 1 });

    console.log('📋 Online Drivers:');
    onlineDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.fullName}`);
      console.log(`   - Position: ${driver.queuePosition || 'NULL'}`);
      console.log(`   - Queue Entry: ${driver.queueEntryTime || 'NULL'}`);
      console.log(`   - Last Active: ${driver.lastActiveTime || 'NULL'}`);
      console.log(`   - Online: ${driver.isOnline}`);
      console.log('');
    });

    console.log(`Total Online Drivers: ${onlineDrivers.length}`);

    // Check for position issues
    const positions = onlineDrivers.map(d => d.queuePosition).filter(p => p !== null);
    const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);

    if (duplicates.length > 0) {
      console.log('🚨 DUPLICATE POSITIONS FOUND:', duplicates);
    }

    const nullPositions = onlineDrivers.filter(d => d.queuePosition === null || d.queuePosition === undefined);
    if (nullPositions.length > 0) {
      console.log(`⚠️ DRIVERS WITH NULL POSITIONS: ${nullPositions.length}`);
      nullPositions.forEach(d => console.log(`   - ${d.fullName}`));
    }

    // Check all positions
    const allPositions = positions.sort((a, b) => a - b);
    console.log('📋 All Queue Positions:', allPositions);

    // Check if all drivers have position 1
    const driversAtPosition1 = onlineDrivers.filter(d => d.queuePosition === 1);
    if (driversAtPosition1.length > 1) {
      console.log(`🚨 CRITICAL: ${driversAtPosition1.length} drivers all have position 1!`);
      driversAtPosition1.forEach(d => console.log(`   - ${d.fullName} (Entry: ${d.queueEntryTime})`));
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });