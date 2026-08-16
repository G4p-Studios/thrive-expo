// Re-export everything for convenient imports

// Storage
export {
  getAccessToken,
  setAccessToken,
  getInstanceUrl,
  setInstanceUrl,
  getAccountCache,
  setAccountCache,
  getInstanceConfigCache,
  setInstanceConfigCache,
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
  uploadFormData,
} from './client';

// Mentions
export {
  buildReplyMentions,
  formatMentionPrefix,
  getReplyTarget,
} from './mentions';

// Status length
export { countStatusCharacters, countableText } from './statusLength';

// Idempotency
export { generateIdempotencyKey } from './idempotency';

// Endpoints
export * from './endpoints/timelines';
export * from './endpoints/statuses';
export * from './endpoints/accounts';
export * from './endpoints/notifications';
export * from './endpoints/lists';
export * from './endpoints/search';
export * from './endpoints/media';
export * from './endpoints/instance';
export * from './endpoints/polls';
export * from './endpoints/reports';
