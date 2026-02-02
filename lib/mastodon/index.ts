// Re-export everything for convenient imports

// Storage
export {
  getAccessToken,
  setAccessToken,
  getInstanceUrl,
  setInstanceUrl,
  getAccountCache,
  setAccountCache,
  clearAuth,
  clearOAuthApps,
  isAuthenticated,
} from './storage';

// OAuth
export {
  registerApp,
  exchangeCode,
  getRedirectUri,
  normalizeInstanceUrl,
} from './oauth';

// Client
export {
  MastodonAPIError,
  NotAuthenticatedError,
  authenticatedFetch,
  mastodonFetch,
} from './client';

// Endpoints
export * from './endpoints/timelines';
export * from './endpoints/statuses';
export * from './endpoints/accounts';
export * from './endpoints/notifications';
export * from './endpoints/lists';
export * from './endpoints/search';
