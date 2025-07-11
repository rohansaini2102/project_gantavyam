const fs = require('fs');
const path = require('path');

// Function to read and parse the frontend pickup locations data
function importPickupLocationsFromFrontend() {
  try {
    // Path to the frontend pickup locations file
    const frontendDataPath = path.join(__dirname, '../../client/src/data/pickupLocations.js');
    
    // Read the file content
    const fileContent = fs.readFileSync(frontendDataPath, 'utf-8');
    
    // Extract the PICKUP_LOCATIONS object
    // This is a simple approach - in production, you might want to use a more robust parser
    const dataMatch = fileContent.match(/export const PICKUP_LOCATIONS = ({[\s\S]*?});/);
    
    if (!dataMatch) {
      throw new Error('Could not extract PICKUP_LOCATIONS from frontend file');
    }
    
    // Parse the JavaScript object (this is a simplified approach)
    // In production, consider using a proper JS parser or converting to JSON
    const dataString = dataMatch[1];
    
    // Simple transformation - replace 'export const PICKUP_LOCATIONS = ' and evaluate
    const PICKUP_LOCATIONS = eval('(' + dataString + ')');
    
    return PICKUP_LOCATIONS;
  } catch (error) {
    console.error('Error importing pickup locations from frontend:', error);
    throw error;
  }
}

// Transform metro stations data
function transformMetroStations(metroData) {
  const stations = [];
  
  for (const [line, stationList] of Object.entries(metroData)) {
    for (const station of stationList) {
      stations.push({
        id: station.id,
        name: station.name,
        type: 'metro',
        subType: line,
        address: station.address,
        lat: station.lat,
        lng: station.lng,
        coordinates: {
          type: 'Point',
          coordinates: [station.lng, station.lat] // GeoJSON format: [longitude, latitude]
        },
        line: line,
        isActive: true,
        priority: getMetroPriority(station.name),
        metadata: {
          description: `${station.name} Metro Station - ${line.charAt(0).toUpperCase() + line.slice(1)} Line`,
          facilities: ['restroom', 'security', 'accessibility'],
          openingHours: '06:00-23:00'
        }
      });
    }
  }
  
  return stations;
}

// Transform railway stations data
function transformRailwayStations(railwayData) {
  return railwayData.map(station => ({
    id: station.id,
    name: station.name,
    type: 'railway',
    subType: station.subType || 'station',
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    coordinates: {
      type: 'Point',
      coordinates: [station.lng, station.lat]
    },
    isActive: true,
    priority: getRailwayPriority(station.name),
    metadata: {
      description: `${station.name} Railway Station`,
      facilities: ['parking', 'restroom', 'food', 'atm', 'taxi'],
      openingHours: '24/7'
    }
  }));
}

// Transform airport data
function transformAirportTerminals(airportData) {
  return airportData.map(terminal => ({
    id: terminal.id,
    name: terminal.name,
    type: 'airport',
    subType: terminal.subType,
    address: terminal.address,
    lat: terminal.lat,
    lng: terminal.lng,
    coordinates: {
      type: 'Point',
      coordinates: [terminal.lng, terminal.lat]
    },
    isActive: true,
    priority: 10, // Highest priority for airports
    metadata: {
      description: `${terminal.name} - ${terminal.subType}`,
      facilities: ['parking', 'restroom', 'food', 'atm', 'taxi', 'wifi', 'duty_free'],
      openingHours: '24/7'
    }
  }));
}

// Add bus terminals (ISBT stations)
function createBusTerminals() {
  return [
    {
      id: 'B-001',
      name: 'ISBT Kashmere Gate',
      type: 'bus_terminal',
      subType: 'ISBT',
      address: 'Kashmere Gate, Delhi',
      lat: 28.6676,
      lng: 77.2281,
      coordinates: {
        type: 'Point',
        coordinates: [77.2281, 28.6676]
      },
      isActive: true,
      priority: 8,
      metadata: {
        description: 'Inter State Bus Terminal Kashmere Gate',
        facilities: ['parking', 'restroom', 'food', 'ticket_counter', 'waiting_area'],
        openingHours: '05:00-23:00'
      }
    },
    {
      id: 'B-002',
      name: 'ISBT Anand Vihar',
      type: 'bus_terminal',
      subType: 'ISBT',
      address: 'Anand Vihar, East Delhi',
      lat: 28.6469,
      lng: 77.3159,
      coordinates: {
        type: 'Point',
        coordinates: [77.3159, 28.6469]
      },
      isActive: true,
      priority: 8,
      metadata: {
        description: 'Inter State Bus Terminal Anand Vihar',
        facilities: ['parking', 'restroom', 'food', 'ticket_counter', 'waiting_area'],
        openingHours: '05:00-23:00'
      }
    },
    {
      id: 'B-003',
      name: 'ISBT Sarai Kale Khan',
      type: 'bus_terminal',
      subType: 'ISBT',
      address: 'Nizamuddin, Delhi',
      lat: 28.5916,
      lng: 77.2542,
      coordinates: {
        type: 'Point',
        coordinates: [77.2542, 28.5916]
      },
      isActive: true,
      priority: 8,
      metadata: {
        description: 'Inter State Bus Terminal Sarai Kale Khan',
        facilities: ['parking', 'restroom', 'food', 'ticket_counter', 'waiting_area'],
        openingHours: '05:00-23:00'
      }
    }
  ];
}

// Priority assignment functions
function getMetroPriority(stationName) {
  const highPriorityStations = [
    'Rajiv Chowk', 'New Delhi', 'Kashmere Gate', 'Central Secretariat',
    'AIIMS', 'Hauz Khas', 'Dwarka Sector 21', 'Noida City Centre',
    'Chandni Chowk', 'Connaught Place'
  ];
  
  const isHighPriority = highPriorityStations.some(station => 
    stationName.toLowerCase().includes(station.toLowerCase())
  );
  
  return isHighPriority ? 7 : 5;
}

function getRailwayPriority(stationName) {
  if (stationName.toLowerCase().includes('new delhi')) return 9;
  if (stationName.toLowerCase().includes('nizamuddin')) return 8;
  if (stationName.toLowerCase().includes('anand vihar')) return 8;
  return 6;
}

// Main function to get all transformed pickup locations
function getAllTransformedPickupLocations() {
  try {
    console.log('📥 Importing pickup locations from frontend...');
    
    const frontendData = importPickupLocationsFromFrontend();
    
    console.log('🔄 Transforming data for backend...');
    
    // Transform each type of location
    const metroStations = transformMetroStations(frontendData.metro);
    const railwayStations = transformRailwayStations(frontendData.railway);
    const airportTerminals = transformAirportTerminals(frontendData.airport);
    const busTerminals = createBusTerminals();
    
    // Combine all locations
    const allLocations = [
      ...metroStations,
      ...railwayStations,
      ...airportTerminals,
      ...busTerminals
    ];
    
    console.log('✅ Data transformation completed:');
    console.log(`   Metro stations: ${metroStations.length}`);
    console.log(`   Railway stations: ${railwayStations.length}`);
    console.log(`   Airport terminals: ${airportTerminals.length}`);
    console.log(`   Bus terminals: ${busTerminals.length}`);
    console.log(`   Total locations: ${allLocations.length}`);
    
    return {
      metro: metroStations,
      railway: railwayStations,
      airport: airportTerminals,
      bus_terminal: busTerminals,
      all: allLocations
    };
    
  } catch (error) {
    console.error('❌ Error transforming pickup locations:', error);
    throw error;
  }
}

module.exports = {
  importPickupLocationsFromFrontend,
  getAllTransformedPickupLocations,
  transformMetroStations,
  transformRailwayStations,
  transformAirportTerminals,
  createBusTerminals
};