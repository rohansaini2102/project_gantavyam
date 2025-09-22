// Test Fast2SMS API without exposing the key
const axios = require('axios');

const API_KEY = 'ts2QDguSLK4e8VRp7BZCzAvMn1W3y9hbfHqiYOkamN06PUlFGwHy2Ob4GTSadpRKXDj35z7miUBnqexL';

async function testAPIKey() {
  try {
    console.log('🧪 Testing Fast2SMS API Key...');

    // Test with wallet balance API first (safer)
    const response = await axios.get('https://www.fast2sms.com/dev/wallet', {
      params: {
        authorization: API_KEY
      }
    });

    console.log('✅ API Key Status: VALID');
    console.log('📊 Wallet Balance: ₹' + response.data.wallet);
    return true;

  } catch (error) {
    console.log('❌ API Key Status: INVALID');
    if (error.response) {
      console.log('Error:', error.response.data);
    }
    return false;
  }
}

testAPIKey();