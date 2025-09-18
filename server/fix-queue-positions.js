const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const Driver = require('./models/Driver');

    console.log('🔧 MANUALLY FIXING QUEUE POSITIONS');
    console.log('==================================');

    // Get all online drivers sorted by queue entry time
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({
      queueEntryTime: 1,
      lastActiveTime: 1 // Fallback
    });

    console.log('📋 Online drivers before fix:');
    onlineDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.fullName} - Position: ${driver.queuePosition || 'NULL'} - Entry: ${driver.queueEntryTime}`);
    });

    // Manually assign correct positions based on entry time
    console.log('\n🔧 Assigning correct positions...');
    for (let i = 0; i < onlineDrivers.length; i++) {
      const driver = onlineDrivers[i];
      const correctPosition = i + 1;

      console.log(`📋 ${driver.fullName}: ${driver.queuePosition || 'NULL'} -> ${correctPosition}`);

      await Driver.findByIdAndUpdate(driver._id, {
        queuePosition: correctPosition
      });
    }

    // Verify the fix
    console.log('\n✅ Verification - checking positions after fix:');
    const fixedDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({ queuePosition: 1 });

    fixedDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.fullName} - Position: ${driver.queuePosition} - Entry: ${driver.queueEntryTime}`);
    });

    console.log('\n🎯 Queue positions manually fixed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });