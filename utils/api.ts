/**
 * @deprecated This file is kept for backwards compatibility.
 * Use functions from @/lib/mastodon instead.
 */

// Re-export from mastodon library for backwards compatibility
export {
  getAccessToken as getSessionToken,
  setAccessToken as setSessionToken,
  clearAuth as clearSessionToken,
} from '@/lib/mastodon/storage';
