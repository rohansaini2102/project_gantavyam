const mongoose = require('mongoose');
require('dotenv').config();

// Simulate what my validateQueueIntegrity function would do
const simulateValidation = (drivers) => {
  console.log('🔍 Simulating validateQueueIntegrity...');

  let hasCriticalIssues = false;
  const issues = [];
  const criticalIssues = [];

  // Check for duplicate positions (CRITICAL - must fix)
  const positions = drivers.map(d => d.queuePosition).filter(p => p !== null);
  const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);

  if (duplicates.length > 0) {
    hasCriticalIssues = true;
    criticalIssues.push(`Duplicate queue positions: ${duplicates.join(', ')}`);
  }

  // Check for drivers without queue entry time (CRITICAL - must fix)
  const driversWithoutEntryTime = drivers.filter(d => !d.queueEntryTime && d.queuePosition);
  if (driversWithoutEntryTime.length > 0) {
    console.log(`⚠️ Found ${driversWithoutEntryTime.length} drivers without queue entry time - would set now`);
    issues.push(`Fixed ${driversWithoutEntryTime.length} drivers without queue entry time`);
  }

  // Check for missing positions (NON-CRITICAL - gaps are OK temporarily)
  const expectedPositions = Array.from({ length: drivers.length }, (_, i) => i + 1);
  const missingPositions = expectedPositions.filter(pos => !positions.includes(pos));
  if (missingPositions.length > 0) {
    issues.push(`Minor gaps in queue positions: ${missingPositions.join(', ')} (will auto-correct gradually)`);
    console.log(`📋 Non-critical queue gaps detected: ${missingPositions.join(', ')} - allowing natural correction`);
  }

  console.log('📋 Critical issues found:', criticalIssues);
  console.log('📋 Non-critical issues:', issues);
  console.log('📋 Would fix critical issues:', hasCriticalIssues);

  return hasCriticalIssues;
};

// Test with the data we saw
const testDrivers = [
  { fullName: 'rohan', queuePosition: 1, queueEntryTime: new Date('2025-09-18T11:03:32+05:30') },
  { fullName: 'Rohan1', queuePosition: 1, queueEntryTime: new Date('2025-09-18T11:31:51+05:30') }
];

console.log('🧪 Testing validation with duplicate position scenario:');
simulateValidation(testDrivers);