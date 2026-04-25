const mongoose = require("mongoose");

async function connectDb() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not defined in .env file.");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
}

module.exports = connectDb;