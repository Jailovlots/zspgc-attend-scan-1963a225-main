// Use VITE_API_URL from .env if set, otherwise fall back to the Render production backend.
// This ensures the app always connects to a working backend whether running locally or deployed.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://zspgc-attend-scan-1963a225-main-6.onrender.com';

