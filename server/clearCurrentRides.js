require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./models/Driver');

async function clearCurrentRides() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    // Clear current rides from all drivers
    const result = await Driver.updateMany(
      { currentRide: { $ne: null } },
      { $unset: { currentRide: "" } }
    );

    console.log(`Cleared current rides from ${result.modifiedCount} drivers`);

    // Show updated driver status
    const drivers = await Driver.find({});
    console.log('\n📊 Updated driver status:');
    drivers.forEach((driver, index) => {
      console.log(`   ${index + 1}. ${driver.fullName} - Online: ${driver.isOnline}, Current Ride: ${driver.currentRide || 'None'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

clearCurrentRides();