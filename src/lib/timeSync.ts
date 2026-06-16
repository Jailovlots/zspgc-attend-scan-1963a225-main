import { API_URL } from "./config";

let timeOffset = 0; // offset in milliseconds
let isSynced = false;

export const syncTimeWithServer = async () => {
  try {
    const startTime = Date.now();
    const res = await fetch(`${API_URL}/api/health`);
    if (res.ok) {
      const data = await res.json();
      const endTime = Date.now();
      
      // Calculate round-trip time (latency)
      const latency = (endTime - startTime) / 2;
      const serverTime = new Date(data.timestamp).getTime();
      
      // Offset formula: Server Time - Local Time
      // We adjust for round-trip latency by adding it to the server timestamp
      timeOffset = (serverTime + latency) - endTime;
      isSynced = true;
      console.log(`[TimeSync] Server offset synced: ${timeOffset}ms (latency: ${latency}ms)`);
    }
  } catch (err) {
    console.error("[TimeSync] Failed to sync time with server:", err);
  }
};

export const getSyncedTime = (): number => {
  return Date.now() + timeOffset;
};

export const isTimeSynced = (): boolean => {
  return isSynced;
};
