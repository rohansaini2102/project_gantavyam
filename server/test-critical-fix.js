const mongoose = require('mongoose');
require('dotenv').config();

// Simulate the fixCriticalQueueIssues function
const testFixCriticalIssues = (drivers) => {
  console.log('🔧 Testing fixCriticalQueueIssues logic...');

  // Find drivers with duplicate positions
  const positions = drivers.map(d => d.queuePosition).filter(p => p !== null);
  const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);

  console.log('📋 Positions:', positions);
  console.log('📋 Duplicates found:', duplicates);

  if (duplicates.length > 0) {
    console.log(`🚨 Fixing ${duplicates.length} duplicate positions:`, duplicates);

    // Only update drivers that have duplicate positions
    let nextAvailablePosition = Math.max(...positions) + 1;
    console.log('📋 Next available position:', nextAvailablePosition);

    for (const duplicatePos of [...new Set(duplicates)]) {
      const driversAtPosition = drivers.filter(d => d.queuePosition === duplicatePos);
      console.log(`📋 Found ${driversAtPosition.length} drivers at position ${duplicatePos}`);

      // Keep the first driver (by entry time) at the original position
      // Move others to new positions
      for (let i = 1; i < driversAtPosition.length; i++) {
        const driver = driversAtPosition[i];
        console.log(`📋 Would move ${driver.fullName} from position ${duplicatePos} to ${nextAvailablePosition}`);
        // In real code: await Driver.findByIdAndUpdate(driver._id, { queuePosition: nextAvailablePosition });
        driver.queuePosition = nextAvailablePosition; // Simulate the update
        nextAvailablePosition++;
      }
    }

    console.log('📋 After fix simulation:');
    drivers.forEach(d => console.log(`   ${d.fullName}: position ${d.queuePosition}`));
  }
};

// Test with the exact data we saw
const testDrivers = [
  { fullName: 'rohan', queuePosition: 1, queueEntryTime: new Date('2025-09-18T11:03:32+05:30') },
  { fullName: 'Rohan1', queuePosition: 1, queueEntryTime: new Date('2025-09-18T11:31:51+05:30') }
];

console.log('🧪 Testing fix with our exact scenario:');
testFixCriticalIssues(testDrivers);