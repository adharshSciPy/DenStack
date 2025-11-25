import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // ✅ REMOVED deprecated options (useNewUrlParser, useUnifiedTopology)
    // ✅ ADDED proper timeout settings
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
      socketTimeoutMS: 45000,          // Close sockets after 45 seconds of inactivity
      family: 4                        // Use IPv4, skip trying IPv6
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // Additional error information for debugging
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Troubleshooting tips:');
      console.error('   1. Check if IP address is whitelisted in MongoDB Atlas');
      console.error('   2. Verify your connection string in .env file');
      console.error('   3. Check your internet connection');
      console.error('   4. Disable VPN if you\'re using one');
    }
    
    process.exit(1); 
  }
};

// Add event listeners for better monitoring
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 Mongoose connection closed due to app termination');
  process.exit(0);
});

export default connectDB;