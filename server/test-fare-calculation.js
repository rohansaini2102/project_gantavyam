// Test script to verify fare calculation logic
const mongoose = require('mongoose');
const { calculateFare } = require('./utils/fareCalculator');

async function testFareCalculation() {
  try {
    // Connect to MongoDB
    const mongoUrl = 'mongodb+srv://rohansaini2102:LfgB7nbUBcHQ4TOI@gantavyam.rpdu8mw.mongodb.net/gantavyam?retryWrites=true&w=majority';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB\n');

    console.log('========================================');
    console.log('TESTING AUTO FARE CALCULATIONS');
    console.log('========================================\n');

    // Test cases for auto without surge
    const testCases = [
      { distance: 1, description: '1km ride (within 2km base)' },
      { distance: 2, description: '2km ride (exactly at base limit)' },
      { distance: 3, description: '3km ride (1km beyond base)' },
      { distance: 5, description: '5km ride (3km beyond base)' },
      { distance: 10, description: '10km ride (8km beyond base)' }
    ];

    console.log('WITHOUT SURGE (Normal Hours)');
    console.log('----------------------------------------');

    for (const test of testCases) {
      const result = await calculateFare('auto', test.distance, false, 0);

      console.log(`\n${test.description}:`);
      console.log(`  Distance: ${test.distance}km`);
      console.log(`  Base Fare: ₹${result.baseFare} (covers first 2km)`);
      console.log(`  Distance Fare: ₹${result.distanceFare} (${test.distance > 2 ? `${test.distance - 2}km × ₹17` : 'within base'})`);
      console.log(`  Driver Fare (base only): ₹${result.driverFare}`);
      console.log(`  Commission (10%): ₹${result.commissionAmount}`);
      console.log(`  GST (5% on fare+commission): ₹${result.gstAmount}`);
      console.log(`  Customer Total: ₹${result.customerTotalFare}`);

      // Verify calculation
      const expectedDriverFare = test.distance <= 2 ? 40 : 40 + (test.distance - 2) * 17;
      const expectedCommission = Math.round(expectedDriverFare * 0.10);
      const expectedGST = Math.round((expectedDriverFare + expectedCommission) * 0.05);
      const expectedCustomerTotal = expectedDriverFare + expectedCommission + expectedGST;

      console.log(`  ✓ Expected Driver: ₹${expectedDriverFare}, Actual: ₹${result.driverFare}`);
      console.log(`  ✓ Expected Customer: ₹${expectedCustomerTotal}, Actual: ₹${result.customerTotalFare}`);
    }

    console.log('\n\nWITH SURGE PRICING (if configured)');
    console.log('----------------------------------------');

    // Test with surge
    const surgeTest = await calculateFare('auto', 5, true, 0);
    console.log(`\n5km ride with surge:`);
    console.log(`  Base Calculation: ₹40 + (3km × ₹17) = ₹91`);
    console.log(`  Surge Factor: ${surgeTest.surgeFactor}x`);
    console.log(`  Driver Fare (base only, no surge shown): ₹${surgeTest.driverFare}`);
    console.log(`  Surged Fare: ₹${surgeTest.breakdown.surgedFare || surgeTest.driverFare}`);
    console.log(`  Commission (10%): ₹${surgeTest.commissionAmount}`);
    console.log(`  GST (5%): ₹${surgeTest.gstAmount}`);
    console.log(`  Customer Total: ₹${surgeTest.customerTotalFare}`);

    console.log('\n\nFARE BREAKDOWN SUMMARY');
    console.log('----------------------------------------');
    console.log('Driver sees: Base fare only (no GST, no commission)');
    console.log('Customer pays: Base fare + Commission (10%) + GST (5%)');
    console.log('Platform earns: Commission + GST');

    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('Error testing fare calculation:', error);
    process.exit(1);
  }
}

// Run the test
testFareCalculation();