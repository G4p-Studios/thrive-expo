import { getAccountCache } from './storage';
import type { MastodonPost } from '@/types/mastodon';

/**
 * The signed-in account, held in memory for callers that cannot await.
 *
 * Reading storage is async, which is fine for a screen but not for something
 * like a render path or an event handler that has to answer immediately. This
 * is primed once at start-up and read synchronously afterwards.
 */
let cached: { id: string; acct: string } | null = null;

/** Load the signed-in account into memory. Safe to call more than once. */
export async function primeCurrentAccount(): Promise<void> {
  try {
    const account = await getAccountCache();
    cached = account ? { id: account.id, acct: account.acct || account.username } : null;
  } catch {
    cached = null;
  }
}

/**
 * The signed-in account if it has been primed, otherwise null.
 *
 * Never read this during render — it is mutable module state, so a render that
 * depends on it is not idempotent. Event handlers and effects are fine.
 */
export function getCurrentAccountSync(): { id: string; acct: string } | null {
  return cached;
}

/** Forget the cached account, e.g. on sign-out. */
export function clearCurrentAccountCache(): void {
  cached = null;
}

/**
 * Whether a post mentions the signed-in account.
 *
 * Returns false until the account has been primed, which is the safe way round:
 * a missed cue is better than a wrong one.
 */
export function postMentionsCurrentUser(post: MastodonPost): boolean {
  const self = cached;
  if (!self) return false;

  const target = post.reblog ?? post;
  const selfAcct = self.acct.toLowerCase();

  return (target.mentions ?? []).some(
    mention => mention.id === self.id || mention.acct.toLowerCase() === selfAcct
  );
}
