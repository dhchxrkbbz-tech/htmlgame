import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

const mongoConnectionOptions = {
  serverSelectionTimeoutMS: 3000,
};

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn("MONGO_URI not configured. Falling back to in-memory auth and marketplace data.");
    connected = false;
    return connected;
  }

  try {
    await mongoose.connect(env.mongoUri, mongoConnectionOptions);
    connected = true;
  } catch (error) {
    console.warn(`MongoDB unavailable at ${env.mongoUri}. Falling back to in-memory auth and marketplace data.`);
    console.warn(`MongoDB connection error: ${error.message}`);
    connected = false;
  }

  return connected;
}

export function isDatabaseConnected() {
  return connected && mongoose.connection.readyState === 1;
}