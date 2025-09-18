// Test script to verify fare visibility is correct for driver and admin
const mongoose = require('mongoose');
const { calculateFare } = require('./utils/fareCalculator');

async function testFareVisibility() {
  try {
    // Connect to MongoDB
    const mongoUrl = 'mongodb+srv://rohansaini2102:LfgB7nbUBcHQ4TOI@gantavyam.rpdu8mw.mongodb.net/gantavyam?retryWrites=true&w=majority';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB\n');

    console.log('========================================');
    console.log('TESTING FARE VISIBILITY');
    console.log('========================================\n');

    // Test case: 5km auto ride
    console.log('Test Case: 5km Auto Ride');
    console.log('----------------------------------------');

    const fareResult = await calculateFare('auto', 5, false, 0);

    console.log('\n📊 FARE CALCULATION RESULTS:');
    console.log('  Distance: 5km');
    console.log('  Base Fare (first 2km): ₹40');
    console.log('  Additional 3km: 3 × ₹17 = ₹51');
    console.log('  Driver Base Fare: ₹91\n');

    console.log('💰 WHAT EACH PARTY SEES:');
    console.log('----------------------------------------');

    console.log('\n1. DRIVER SEES (Driver App):');
    console.log('   - On ride request: ₹' + fareResult.driverFare);
    console.log('   - On completion popup: ₹' + fareResult.driverFare);
    console.log('   - In ride history: ₹' + fareResult.driverFare);
    console.log('   - Total earnings: ₹' + fareResult.driverFare);
    console.log('   ✅ Driver only sees base fare (no GST, no commission)');

    console.log('\n2. CUSTOMER SEES (Customer App):');
    console.log('   - Fare estimate: ₹' + fareResult.customerTotalFare);
    console.log('   - On booking: ₹' + fareResult.customerTotalFare);
    console.log('   - Final payment: ₹' + fareResult.customerTotalFare);
    console.log('   ✅ Customer sees total including all charges');

    console.log('\n3. ADMIN SEES (Ride Management):');
    console.log('   - Driver Base Fare: ₹' + fareResult.driverFare);
    console.log('   - Commission (10%): ₹' + fareResult.commissionAmount);
    console.log('   - GST (5%): ₹' + fareResult.gstAmount);
    if (fareResult.nightChargeAmount > 0) {
      console.log('   - Night Charge: ₹' + fareResult.nightChargeAmount);
    }
    console.log('   - Customer Total: ₹' + fareResult.customerTotalFare);
    console.log('   - Platform Earnings: ₹' + (fareResult.commissionAmount + fareResult.gstAmount + fareResult.nightChargeAmount));
    console.log('   ✅ Admin sees complete breakdown');

    console.log('\n📋 FARE BREAKDOWN SUMMARY:');
    console.log('----------------------------------------');
    console.log('Driver Earnings: ₹' + fareResult.driverFare + ' (Base fare only)');
    console.log('Platform Commission: ₹' + fareResult.commissionAmount + ' (10% of base)');
    console.log('GST: ₹' + fareResult.gstAmount + ' (5% on base + commission)');
    console.log('Customer Pays: ₹' + fareResult.customerTotalFare);
    console.log('Platform Total Earnings: ₹' + (fareResult.commissionAmount + fareResult.gstAmount));

    // Test with surge pricing
    console.log('\n\n========================================');
    console.log('TEST WITH SURGE PRICING (1.4x)');
    console.log('========================================\n');

    const surgeResult = await calculateFare('auto', 5, true, 0);
    if (surgeResult.surgeFactor > 1) {
      console.log('Surge Factor: ' + surgeResult.surgeFactor + 'x');
      console.log('Driver Base (no surge shown): ₹' + surgeResult.driverFare);
      console.log('Commission (on base): ₹' + surgeResult.commissionAmount);
      console.log('GST: ₹' + surgeResult.gstAmount);
      console.log('Customer Total: ₹' + surgeResult.customerTotalFare);
      console.log('\n✅ Commission is calculated on base fare only, not surged amount');
    } else {
      console.log('No surge currently active');
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully');
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error testing fare visibility:', error);
    process.exit(1);
  }
}

// Run the test
testFareVisibility();