// Set VITE_API_URL to the public backend origin (without a trailing slash) in Vercel.
// Local Vite development uses the /api proxy when this is unset.
const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const apiUrl = (path: string) => origin + path;
