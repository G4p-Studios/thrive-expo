import type { MastodonPost } from '@/types/mastodon';

/**
 * Resolve the status a reply should actually attach to.
 *
 * Boosts are statuses in their own right, but replying to one should thread
 * under the boosted post, not the boost wrapper.
 */
export function getReplyTarget(post: MastodonPost): MastodonPost {
  return post.reblog ?? post;
}

/**
 * Build the ordered list of handles to pre-fill when replying to a post.
 *
 * Handles are webfinger `acct` values, so remote accounts keep their domain
 * (`alex@example.social`). A bare `@alex` would otherwise be resolved by the
 * server against its *own* local accounts, silently mentioning the wrong person
 * — or nobody — whenever the author lives on another instance.
 *
 * The author of the post comes first, followed by everyone else it mentions so
 * that a thread keeps its participants. The replying user is dropped: Mastodon
 * never expects you to mention yourself.
 *
 * @param post      The post being replied to (a boost is unwrapped first).
 * @param selfAcct  The replying user's own handle, omitted from the result.
 */
export function buildReplyMentions(post: MastodonPost, selfAcct?: string): string[] {
  const target = getReplyTarget(post);
  const candidates = [
    target.account.acct,
    ...(target.mentions ?? []).map((mention) => mention.acct),
  ];

  // Handles are case-insensitive, so compare lowercased but keep the original
  // casing for display.
  const self = selfAcct?.toLowerCase();
  const seen = new Set<string>();
  const handles: string[] = [];

  for (const handle of candidates) {
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (key === self || seen.has(key)) continue;
    seen.add(key);
    handles.push(handle);
  }

  return handles;
}

/**
 * Render handles as the leading `@mention ` text of a reply.
 * Returns an empty string when there is nobody to mention.
 */
export function formatMentionPrefix(handles: string[]): string {
  return handles.length > 0 ? `${handles.map((h) => `@${h}`).join(' ')} ` : '';
}
