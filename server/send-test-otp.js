// Test sending OTP to specific number
const axios = require('axios');

const API_KEY = 'ts2QDguSLK4e8VRp7BZCzAvMn1W3y9hbfHqiYOkamN06PUlFGwHy2Ob4GTSadpRKXDj35z7miUBnqexL';
const TEST_MOBILE = '9358577653';
const TEST_OTP = '1234';

async function sendTestOTP() {
  try {
    console.log('📱 Sending test OTP...');
    console.log('To:', TEST_MOBILE);
    console.log('OTP:', TEST_OTP);

    // Using Quick SMS route - works without DLT approval
    const message = `Your ride OTP is ${TEST_OTP}. Please share this with your driver.`;
    const response = await axios.post('https://www.fast2sms.com/dev/bulkV2',
      `message=${encodeURIComponent(message)}&route=q&numbers=${TEST_MOBILE}`,
    {
      headers: {
        'authorization': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('\n📥 Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.return === true) {
      console.log('\n✅ SUCCESS: OTP sent successfully!');
      console.log('Message ID:', response.data.request_id);
      console.log('Message will be: "' + TEST_OTP + ' is your verification code."');
    } else {
      console.log('\n❌ FAILED: OTP sending failed');
      console.log('Error details:', response.data);
    }

  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Run the test
sendTestOTP();