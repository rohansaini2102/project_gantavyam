// Script to update fare config in database
const mongoose = require('mongoose');
const FareConfig = require('./models/FareConfig');

async function updateFareConfig() {
  try {
    // Connect to MongoDB
    const mongoUrl = 'mongodb+srv://rohansaini2102:LfgB7nbUBcHQ4TOI@gantavyam.rpdu8mw.mongodb.net/gantavyam?retryWrites=true&w=majority';
    await mongoose.connect(mongoUrl);

    console.log('Connected to MongoDB');

    // Delete all existing configs
    await FareConfig.deleteMany({});
    console.log('Cleared existing fare configs');

    // Create new config with proper structure
    const newConfig = await FareConfig.create({
      vehicleConfigs: {
        bike: {
          baseFare: 30, // For first 2 km
          perKmRate: 12, // After 2 km
          minimumFare: 30,
          waitingChargePerMin: 1,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        },
        auto: {
          baseFare: 40, // For first 2 km
          perKmRate: 17, // After 2 km
          minimumFare: 40,
          waitingChargePerMin: 2,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        },
        car: {
          baseFare: 60, // For first 2 km
          perKmRate: 25, // After 2 km
          minimumFare: 60,
          waitingChargePerMin: 3,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        }
      },
      surgeTimes: [
        {
          name: 'Morning Peak',
          startHour: 8,
          endHour: 10,
          factor: 1.3,
          isActive: true
        },
        {
          name: 'Evening Peak',
          startHour: 17,
          endHour: 20,
          factor: 1.4,
          isActive: true
        },
        {
          name: 'Night',
          startHour: 22,
          endHour: 5,
          factor: 1.2,
          isActive: true
        }
      ],
      dynamicPricing: [
        {
          name: 'No Drivers',
          minRatio: 0,
          maxRatio: 0,
          factor: 1.8,
          description: 'When no drivers are available'
        },
        {
          name: 'High Demand',
          minRatio: 3,
          maxRatio: null,
          factor: 1.5,
          description: 'More than 3 requests per driver'
        },
        {
          name: 'Medium Demand',
          minRatio: 2,
          maxRatio: 3,
          factor: 1.3,
          description: '2-3 requests per driver'
        },
        {
          name: 'Low Demand',
          minRatio: 1,
          maxRatio: 2,
          factor: 1.2,
          description: '1-2 requests per driver'
        },
        {
          name: 'Normal',
          minRatio: 0,
          maxRatio: 1,
          factor: 1.0,
          description: 'Less than 1 request per driver'
        }
      ],
      nightCharge: {
        isActive: true,
        startHour: 23, // 11 PM
        endHour: 5, // 5 AM
        percentage: 20
      },
      isActive: true
    });

    console.log('✅ New fare config created successfully');
    console.log('Config details:', JSON.stringify(newConfig.vehicleConfigs, null, 2));

    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error updating fare config:', error);
    process.exit(1);
  }
}

// Run the update
updateFareConfig();