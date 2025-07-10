// utils/seedMetroStations.js
const MetroStation = require('../models/MetroStation');

const DELHI_METRO_STATIONS = [
  // Red Line
  { id: 1, name: "Rithala", line: "Red", lat: 28.7206, lng: 77.1011 },
  { id: 2, name: "Rohini East", line: "Red", lat: 28.7077, lng: 77.1067 },
  { id: 3, name: "Pitampura", line: "Red", lat: 28.7026, lng: 77.1386 },
  { id: 4, name: "Kashmere Gate", line: "Red", lat: 28.6676, lng: 77.2281 },
  { id: 5, name: "Chandni Chowk", line: "Red", lat: 28.6580, lng: 77.2302 },
  { id: 6, name: "Chawri Bazar", line: "Red", lat: 28.6489, lng: 77.2263 },
  { id: 7, name: "New Delhi", line: "Red", lat: 28.6431, lng: 77.2211 },
  { id: 8, name: "Dilshad Garden", line: "Red", lat: 28.6752, lng: 77.3208 },

  // Yellow Line
  { id: 9, name: "Samaypur Badli", line: "Yellow", lat: 28.7473, lng: 77.1377 },
  { id: 10, name: "Vishwavidyalaya", line: "Yellow", lat: 28.6950, lng: 77.2146 },
  { id: 11, name: "Civil Lines", line: "Yellow", lat: 28.6773, lng: 77.2241 },
  { id: 12, name: "Rajiv Chowk", line: "Yellow", lat: 28.6328, lng: 77.2197 },
  { id: 13, name: "Central Secretariat", line: "Yellow", lat: 28.6149, lng: 77.2125 },
  { id: 14, name: "AIIMS", line: "Yellow", lat: 28.5686, lng: 77.2080 },
  { id: 15, name: "Hauz Khas", line: "Yellow", lat: 28.5433, lng: 77.2066 },
  { id: 16, name: "Saket", line: "Yellow", lat: 28.5208, lng: 77.2015 },
  { id: 17, name: "HUDA City Centre", line: "Yellow", lat: 28.4595, lng: 77.0266 },

  // Blue Line
  { id: 18, name: "Dwarka Sector 21", line: "Blue", lat: 28.5527, lng: 77.0585 },
  { id: 19, name: "Dwarka", line: "Blue", lat: 28.6157, lng: 77.0218 },
  { id: 20, name: "Janakpuri West", line: "Blue", lat: 28.6293, lng: 77.0878 },
  { id: 21, name: "Rajouri Garden", line: "Blue", lat: 28.6494, lng: 77.1227 },
  { id: 22, name: "Ramesh Nagar", line: "Blue", lat: 28.6532, lng: 77.1316 },
  { id: 23, name: "Moti Nagar", line: "Blue", lat: 28.6576, lng: 77.1427 },
  { id: 24, name: "Karol Bagh", line: "Blue", lat: 28.6527, lng: 77.1902 },
  { id: 25, name: "Barakhamba Road", line: "Blue", lat: 28.6296, lng: 77.2246 },
  { id: 26, name: "Mandi House", line: "Blue", lat: 28.6258, lng: 77.2341 },
  { id: 27, name: "Yamuna Bank", line: "Blue", lat: 28.6148, lng: 77.3080 },
  { id: 28, name: "Noida City Centre", line: "Blue", lat: 28.5746, lng: 77.3560 },
  { id: 29, name: "Electronic City", line: "Blue", lat: 28.6280, lng: 77.3752 },

  // Green Line
  { id: 30, name: "Kirti Nagar", line: "Green", lat: 28.6556, lng: 77.1506 },
  { id: 31, name: "Inderlok", line: "Green", lat: 28.6730, lng: 77.1703 },
  { id: 32, name: "Ashok Park Main", line: "Green", lat: 28.6717, lng: 77.1555 },

  // Violet Line
  { id: 33, name: "Central Secretariat", line: "Violet", lat: 28.6149, lng: 77.2125 },
  { id: 34, name: "Khan Market", line: "Violet", lat: 28.6003, lng: 77.2269 },
  { id: 35, name: "JLN Stadium", line: "Violet", lat: 28.5905, lng: 77.2337 },
  { id: 36, name: "Jangpura", line: "Violet", lat: 28.5846, lng: 77.2377 },
  { id: 37, name: "Lajpat Nagar", line: "Violet", lat: 28.5708, lng: 77.2365 },
  { id: 38, name: "Moolchand", line: "Violet", lat: 28.5644, lng: 77.2342 },
  { id: 39, name: "Kailash Colony", line: "Violet", lat: 28.5552, lng: 77.2420 },
  { id: 40, name: "Nehru Place", line: "Violet", lat: 28.5519, lng: 77.2519 },
  { id: 41, name: "Kalkaji Mandir", line: "Violet", lat: 28.5504, lng: 77.2585 },
  { id: 42, name: "Faridabad", line: "Violet", lat: 28.4082, lng: 77.3178 },

  // Pink Line
  { id: 43, name: "Majlis Park", line: "Pink", lat: 28.7241, lng: 77.1307 },
  { id: 44, name: "Azadpur", line: "Pink", lat: 28.7066, lng: 77.1806 },
  { id: 45, name: "Netaji Subhash Place", line: "Pink", lat: 28.6963, lng: 77.1524 },
  { id: 46, name: "Durgabai Deshmukh South Campus", line: "Pink", lat: 28.5440, lng: 77.2167 },
  { id: 47, name: "Lajpat Nagar", line: "Pink", lat: 28.5708, lng: 77.2365 },
  { id: 48, name: "Mayur Vihar-1", line: "Pink", lat: 28.6042, lng: 77.2893 },

  // Magenta Line
  { id: 49, name: "Botanical Garden", line: "Magenta", lat: 28.5640, lng: 77.3342 },
  { id: 50, name: "Hauz Khas", line: "Magenta", lat: 28.5433, lng: 77.2066 },
  { id: 51, name: "Terminal 1-IGI Airport", line: "Magenta", lat: 28.5562, lng: 77.0870 },
  { id: 52, name: "Shankar Vihar", line: "Magenta", lat: 28.5789, lng: 77.1305 },

  // Orange Line (Airport Express)
  { id: 53, name: "New Delhi Metro", line: "Orange", lat: 28.6431, lng: 77.2211 },
  { id: 54, name: "Shivaji Stadium", line: "Orange", lat: 28.6290, lng: 77.2116 },
  { id: 55, name: "Dhaula Kuan", line: "Orange", lat: 28.5918, lng: 77.1609 },
  { id: 56, name: "IGI Airport", line: "Orange", lat: 28.5562, lng: 77.0870 },
  { id: 57, name: "Dwarka Sector 21", line: "Orange", lat: 28.5527, lng: 77.0585 }
];

/**
 * Seed metro stations data into the database
 */
const seedMetroStations = async () => {
  try {
    console.log('🚇 Starting metro stations seeding...');
    
    // Clear existing data
    await MetroStation.deleteMany({});
    console.log('🗑️ Cleared existing metro stations');

    // Prepare data with coordinates in GeoJSON format
    const stationsData = DELHI_METRO_STATIONS.map(station => ({
      ...station,
      location: {
        type: 'Point',
        coordinates: [station.lng, station.lat]
      }
    }));

    // Insert new data
    await MetroStation.insertMany(stationsData);
    console.log(`✅ Successfully seeded ${stationsData.length} metro stations`);
    
    // Log summary by line
    const lines = [...new Set(DELHI_METRO_STATIONS.map(s => s.line))];
    for (const line of lines) {
      const count = DELHI_METRO_STATIONS.filter(s => s.line === line).length;
      console.log(`   ${line} Line: ${count} stations`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error seeding metro stations:', error);
    return false;
  }
};

module.exports = {
  seedMetroStations,
  DELHI_METRO_STATIONS
};