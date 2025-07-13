const mongoose = require('mongoose');
require('dotenv').config();

async function testRideData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const RideRequest = require('./models/RideRequest');
    
    // Get the most recent ride
    const recentRide = await RideRequest.findOne().sort({ createdAt: -1, timestamp: -1 });
    
    if (recentRide) {
      console.log('Most recent ride:');
      console.log('ID:', recentRide._id);
      console.log('Status:', recentRide.status);
      console.log('Created:', recentRide.createdAt);
      console.log('Timestamp:', recentRide.timestamp);
      console.log('Pickup Location:', JSON.stringify(recentRide.pickupLocation, null, 2));
      console.log('User Name:', recentRide.userName);
      console.log('Vehicle Type:', recentRide.vehicleType);
    } else {
      console.log('No rides found');
    }
    
    const totalRides = await RideRequest.countDocuments();
    console.log('Total rides in database:', totalRides);
    
    const recentRides = await RideRequest.countDocuments({
      $or: [
        { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    });
    console.log('Recent rides (24h):', recentRides);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testRideData();