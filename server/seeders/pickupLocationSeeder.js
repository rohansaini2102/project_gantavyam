const PickupLocation = require('../models/PickupLocation');
const { getAllTransformedPickupLocations } = require('../utils/importPickupLocations');

// Main seeding function
async function seedPickupLocations() {
  try {
    console.log('\n🌱 Starting pickup location seeding...');
    
    // Import and transform data from frontend
    const transformedData = getAllTransformedPickupLocations();
    
    // Check if data already exists
    const existingCount = await PickupLocation.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing pickup locations.`);
      console.log('🗑️  Clearing existing data...');
      await PickupLocation.deleteMany({});
    }
    
    let totalInserted = 0;
    const results = {};
    
    // Seed each type of transportation hub
    for (const [type, locations] of Object.entries(transformedData)) {
      if (type === 'all') continue; // Skip the 'all' array
      
      console.log(`\n📍 Seeding ${type} locations...`);
      
      if (locations.length > 0) {
        console.log(`  📝 Attempting to insert ${locations.length} ${type} locations...`);
        console.log(`  🔍 Sample data:`, JSON.stringify(locations[0], null, 2));
        
        try {
          const inserted = await PickupLocation.insertMany(locations, { ordered: false });
          results[type] = inserted.length;
          totalInserted += inserted.length;
          console.log(`✅ Inserted ${inserted.length} ${type} locations`);
        } catch (insertError) {
          console.error(`❌ Error inserting ${type} locations:`, insertError.message);
          if (insertError.writeErrors) {
            console.error('Write errors:', insertError.writeErrors.slice(0, 3)); // Show first 3 errors
          }
        }
      }
    }
    
    // Create indexes
    console.log('\n🔍 Creating database indexes...');
    await PickupLocation.createIndexes();
    
    // Summary
    console.log('\n🎉 Pickup location seeding completed successfully!');
    console.log('📊 Summary:');
    for (const [type, count] of Object.entries(results)) {
      console.log(`   ${type}: ${count} locations`);
    }
    console.log(`   Total: ${totalInserted} pickup locations`);
    
    // Verify data
    const verification = await PickupLocation.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n✅ Database verification:');
    verification.forEach(({ _id, count }) => {
      console.log(`   ${_id}: ${count} records`);
    });
    
    return {
      success: true,
      totalInserted,
      results,
      verification
    };
    
  } catch (error) {
    console.error('❌ Error seeding pickup locations:', error);
    throw error;
  }
}

// Export the seeder function
module.exports = {
  seedPickupLocations
};

// Run seeder if called directly
if (require.main === module) {
  const mongoose = require('mongoose');
  
  // Connect to database
  require('dotenv').config();
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3')
    .then(() => {
      console.log('📱 Connected to MongoDB');
      return seedPickupLocations();
    })
    .then((result) => {
      console.log('🎯 Seeding completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}