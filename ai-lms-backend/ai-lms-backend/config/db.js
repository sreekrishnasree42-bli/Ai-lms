const mongoose = require("mongoose");

/**
 * Connects to MongoDB using MONGO_URI from .env.
 * Exits the process on failure so the app never starts in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB connected → ${conn.connection.host}`);

    mongoose.connection.on("disconnected", () =>
      console.warn("⚠️  MongoDB disconnected")
    );
  } catch (err) {
    console.error(`❌  MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
