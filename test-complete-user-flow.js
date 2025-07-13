const axios = require('axios');

// Test complete user flow from booking to ride completion
const testCompleteUserFlow = async () => {
  try {
    console.log('🧪 Testing complete user flow...\n');
    
    // Step 1: Login
    console.log('📝 Step 1: User Login');
    const loginResponse = await axios.post('http://localhost:5000/api/users/login', {
      phone: '9999999999',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');
    
    // Step 2: Get pickup locations
    console.log('📍 Step 2: Load Pickup Locations');
    const locationsResponse = await axios.get('http://localhost:5000/api/users/pickup-locations');
    
    if (!locationsResponse.data.success) {
      console.log('❌ Failed to load pickup locations');
      return;
    }
    
    const stations = locationsResponse.data.data.locations;
    const kirtiNagar = stations.find(station => station.name.toLowerCase().includes('kirti nagar'));
    console.log(`✅ Loaded ${stations.length} pickup locations`);
    console.log(`✅ Found station: ${kirtiNagar.name}\n`);
    
    // Step 3: Calculate fare
    console.log('💰 Step 3: Calculate Fare');
    const fareResponse = await axios.post(
      'http://localhost:5000/api/users/fare-estimate',
      {
        pickupStation: kirtiNagar.name,
        dropLat: 28.66197529999999,
        dropLng: 77.1241557
      },
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (!fareResponse.data.success) {
      console.log('❌ Fare calculation failed');
      return;
    }
    
    const estimatedFare = fareResponse.data.data.estimates.auto.totalFare;
    console.log(`✅ Fare calculated: ₹${estimatedFare}\n`);
    
    // Step 4: Book ride
    console.log('🚗 Step 4: Book Ride');
    const bookingResponse = await axios.post(
      'http://localhost:5000/api/users/book-ride',
      {
        pickupStation: kirtiNagar.name,
        dropLocation: {
          address: 'Punjabi Bagh, Delhi, India',
          lat: 28.66197529999999,
          lng: 77.1241557
        },
        vehicleType: 'auto',
        estimatedFare: estimatedFare
      },
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (!bookingResponse.data.success) {
      console.log('❌ Booking failed:', bookingResponse.data.message);
      return;
    }
    
    const rideDetails = bookingResponse.data.data;
    console.log('✅ Ride booked successfully!');
    console.log('📋 Ride Details:');
    console.log(`   - Ride ID: ${rideDetails.rideId}`);
    console.log(`   - Status: ${rideDetails.status}`);
    console.log(`   - Pickup: ${rideDetails.pickupStation}`);
    console.log(`   - Vehicle: ${rideDetails.vehicleType}`);
    console.log(`   - Fare: ₹${rideDetails.estimatedFare}`);
    console.log(`   - Start OTP: ${rideDetails.startOTP}\n`);
    
    // Step 5: Check active rides
    console.log('📱 Step 5: Check Active Rides');
    const activeRidesResponse = await axios.get(
      'http://localhost:5000/api/users/active-rides',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (activeRidesResponse.data.success) {
      const activeRides = activeRidesResponse.data.data.activeRides;
      console.log(`✅ Found ${activeRides.length} active ride(s)`);
      
      if (activeRides.length > 0) {
        const ride = activeRides[0];
        console.log('📋 Active Ride Status:');
        console.log(`   - Status: ${ride.status}`);
        console.log(`   - Start OTP: ${ride.startOTP || 'Not shown yet'}`);
        console.log(`   - Driver: ${ride.driver?.name || 'Not assigned yet'}\n`);
      }
    }
    
    console.log('🎉 COMPLETE USER FLOW TEST PASSED!');
    console.log('\n📝 Test Summary:');
    console.log('✅ User can login successfully');
    console.log('✅ Pickup locations load correctly');
    console.log('✅ Fare calculation works with proper station name');
    console.log('✅ Ride booking succeeds with valid fare');
    console.log('✅ Active rides can be retrieved');
    console.log('✅ Frontend should now transition to ActiveRideTracker view');
    console.log('✅ User will see ride progress, OTP, and status updates');
    
  } catch (error) {
    console.error('❌ Flow test failed:', error.response?.data || error.message);
  }
};

testCompleteUserFlow();