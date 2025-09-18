const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const Driver = require('./models/Driver');

    console.log('🧪 TESTING WHAT HAPPENS WHEN DRIVER GOES ONLINE');
    console.log('===============================================');

    // First, let's set both drivers to offline to reset the scenario
    console.log('📋 Step 1: Setting all drivers offline...');
    await Driver.updateMany({}, {
      isOnline: false,
      queuePosition: null,
      queueEntryTime: null
    });

    // Now simulate rohan going online first
    console.log('📋 Step 2: Simulating rohan going online...');
    const rohan = await Driver.findOne({ fullName: 'rohan' });
    if (rohan) {
      const queueEntryTime1 = new Date();
      await Driver.findByIdAndUpdate(rohan._id, {
        isOnline: true,
        queueEntryTime: queueEntryTime1,
        lastActiveTime: queueEntryTime1
      });

      // Simulate updateQueueAfterDriverAddition logic
      const onlineDriversExcludingRohan = await Driver.find({
        isOnline: true,
        isVerified: true,
        _id: { $ne: rohan._id }
      });
      const newPositionForRohan = onlineDriversExcludingRohan.length + 1;

      console.log(`📋 Rohan should get position: ${newPositionForRohan} (${onlineDriversExcludingRohan.length} other drivers online)`);

      await Driver.findByIdAndUpdate(rohan._id, {
        queuePosition: newPositionForRohan
      });
    }

    // Now simulate Rohan1 going online
    console.log('📋 Step 3: Simulating Rohan1 going online...');
    const rohan1 = await Driver.findOne({ fullName: 'Rohan1' });
    if (rohan1) {
      const queueEntryTime2 = new Date();
      await Driver.findByIdAndUpdate(rohan1._id, {
        isOnline: true,
        queueEntryTime: queueEntryTime2,
        lastActiveTime: queueEntryTime2
      });

      // Simulate updateQueueAfterDriverAddition logic
      const onlineDriversExcludingRohan1 = await Driver.find({
        isOnline: true,
        isVerified: true,
        _id: { $ne: rohan1._id }
      });
      const newPositionForRohan1 = onlineDriversExcludingRohan1.length + 1;

      console.log(`📋 Rohan1 should get position: ${newPositionForRohan1} (${onlineDriversExcludingRohan1.length} other drivers online)`);

      await Driver.findByIdAndUpdate(rohan1._id, {
        queuePosition: newPositionForRohan1
      });
    }

    // Check final state
    console.log('📋 Step 4: Final queue state after simulation...');
    const finalDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({ queuePosition: 1 });

    finalDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.fullName} - Position: ${driver.queuePosition} - Entry: ${driver.queueEntryTime}`);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });