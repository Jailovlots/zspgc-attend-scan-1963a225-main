import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisUrl = process.env.REDIS_URL || '';
redisUrl = redisUrl.replace(/["']/g, ''); // Remove any stray quotes

if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
  redisUrl = redisUrl.replace('redis://', 'rediss://');
}

const redisClient = createClient({
  url: redisUrl || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 2) {
        return false;
      }
      return 1000;
    }
  }
});

redisClient.on("error", (err) => {
  // Silent or single line warning instead of verbose trace
  console.warn("Redis Client Warning:", err.message);
});

try {
  await redisClient.connect();
  console.log("Connected to Redis successfully");
} catch (err) {
  console.warn("Failed to connect to Redis. Running without active Redis client:", err.message);
}

export default redisClient;
