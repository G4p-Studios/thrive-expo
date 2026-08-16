/**
 * Generate a value for the `Idempotency-Key` header.
 *
 * Mastodon uses this key only to collapse duplicate submissions of the same
 * post — it is not a secret and is never used for authentication — so it needs
 * to be *unique*, not unpredictable. That lets us avoid pulling in a native
 * crypto module (and the rebuild it would require) for a non-security value.
 *
 * The key must stay the same across retries of one post and differ between
 * different posts, so callers should generate it once per compose attempt and
 * hold onto it until the post succeeds.
 */
export function generateIdempotencyKey(): string {
  const chunk = () => Math.random().toString(36).slice(2, 10).padStart(8, '0');
  return `${Date.now().toString(36)}-${chunk()}-${chunk()}`;
}
