require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./models/Driver');

async function testDriverStatus() {
  try {
    // Connect to MongoDB using the same connection string as the server
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/gantavyam';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Fetch all drivers
    const drivers = await Driver.find({});
    console.log(`\n📊 Total drivers: ${drivers.length}`);

    drivers.forEach((driver, index) => {
      console.log(`\n👤 Driver ${index + 1}: ${driver.fullName}`);
      console.log(`   📱 Phone: ${driver.mobileNo}`);
      console.log(`   🚗 Vehicle: ${driver.vehicleType} - ${driver.vehicleNo}`);
      console.log(`   🟢 Online: ${driver.isOnline}`);
      console.log(`   📍 Metro Booth: ${driver.currentMetroBooth || 'Not set'}`);
      console.log(`   🚦 Current Ride: ${driver.currentRide || 'None'}`);
      console.log(`   🏆 Queue Position: ${driver.queuePosition || 'Not set'}`);
      console.log(`   ⏰ Queue Entry: ${driver.queueEntryTime || 'Not set'}`);
    });

    // Set both drivers online for testing
    console.log('\n🔧 Setting drivers online for testing...');
    
    const updates = await Promise.all(drivers.map(async (driver, index) => {
      return Driver.findByIdAndUpdate(driver._id, {
        isOnline: true,
        currentMetroBooth: 'Rajiv Chowk', // Set to a common metro station
        queuePosition: index + 1,
        queueEntryTime: new Date(Date.now() - (index * 60000)), // Stagger entry times
        lastActiveTime: new Date()
      }, { new: true });
    }));

    console.log('\n✅ Updated driver status:');
    updates.forEach((driver, index) => {
      console.log(`   ${index + 1}. ${driver.fullName} - Online: ${driver.isOnline}, Booth: ${driver.currentMetroBooth}, Queue: #${driver.queuePosition}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testDriverStatus();