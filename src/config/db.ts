import mongoose from "mongoose";

let cachedConnection: typeof mongoose | null = null;
let pendingConnection: Promise<typeof mongoose> | null = null;

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (pendingConnection) {
    return pendingConnection;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  mongoose.set("strictQuery", true);
  pendingConnection = mongoose.connect(uri);
  cachedConnection = await pendingConnection;
  pendingConnection = null;
  console.log("MongoDB connected");

  return cachedConnection;
}

export default connectDB;
