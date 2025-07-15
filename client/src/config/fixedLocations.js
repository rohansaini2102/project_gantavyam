// Fixed pickup location configuration
// For now, the system only supports pickup from Hauz Khas Metro Station Gate No 1

export const FIXED_PICKUP_LOCATION = {
  id: 'M-Y-024-GATE1', // Modified ID to indicate Gate 1
  name: 'Hauz Khas Metro Gate No 1',
  type: 'metro',
  subType: 'Yellow Line',
  address: 'Hauz Khas Metro Station Gate No 1, Outer Ring Road, Hauz Khas, New Delhi',
  lat: 28.5433, // Coordinates from existing data, will be refined if needed
  lng: 77.2066,
  line: 'yellow',
  isActive: true,
  priority: 10, // Highest priority
  metadata: {
    description: 'Fixed pickup location - Hauz Khas Metro Station Gate No 1',
    facilities: ['parking', 'waiting_area'],
    gateNumber: 1,
    googleMapsUrl: 'https://maps.app.goo.gl/eUY4RznKCNvTuciTA'
  }
};

// Helper function to get the fixed pickup location
export const getFixedPickupLocation = () => {
  return FIXED_PICKUP_LOCATION;
};

// Message to display to users about the fixed pickup location
export const FIXED_PICKUP_MESSAGE = 'Pickup is currently available only from Hauz Khas Metro Station Gate No 1';