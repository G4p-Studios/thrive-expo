import { get, post, del } from '../client';
import { mapAccount, mapPost, mapPreviewCard, mapSuggestion, mapTag } from '../mappers';
import { getInstanceUrl } from '../storage';
import type {
  MastodonAccount,
  MastodonPost,
  MastodonPreviewCard,
  MastodonSuggestion,
  MastodonTag,
} from '@/types/mastodon';

/**
 * Hashtags gaining use over the past week.
 *
 * Trends are ranked by an internal score rather than chronologically, and
 * paginate with `offset` rather than an id cursor.
 */
export async function getTrendingTags(offset = 0, limit = 20): Promise<MastodonTag[]> {
  const raw = await get<any[]>('/api/v1/trends/tags', {
    limit: String(limit),
    offset: offset > 0 ? String(offset) : undefined,
  });
  return (raw || []).map(mapTag);
}

/**
 * Posts currently getting the most interaction.
 */
export async function getTrendingPosts(offset = 0, limit = 20): Promise<MastodonPost[]> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/trends/statuses', {
    limit: String(limit),
    offset: offset > 0 ? String(offset) : undefined,
  });
  return (raw || []).map(p => mapPost(p, instanceUrl));
}

/**
 * Links being shared widely right now.
 */
export async function getTrendingLinks(offset = 0, limit = 20): Promise<MastodonPreviewCard[]> {
  const raw = await get<any[]>('/api/v1/trends/links', {
    limit: String(limit),
    offset: offset > 0 ? String(offset) : undefined,
  });
  return (raw || []).map(mapPreviewCard);
}

/**
 * Accounts the server thinks you might want to follow.
 *
 * The v1 endpoint has been deprecated since Mastodon 3.4.
 */
export async function getSuggestions(limit = 40): Promise<MastodonSuggestion[]> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v2/suggestions', { limit: String(limit) });
  return (raw || []).map(s => mapSuggestion(s, instanceUrl));
}

/**
 * Stop the server suggesting an account.
 *
 * Succeeds even for an account that was never suggested.
 */
export async function dismissSuggestion(accountId: string): Promise<void> {
  await del(`/api/v1/suggestions/${encodeURIComponent(accountId)}`);
}

/**
 * Browse profiles that have opted into discovery.
 *
 * @param order  `active` puts recently-active accounts first, `new` the newest.
 * @param local  Restrict to accounts on this server.
 */
export async function getDirectory(
  options: { offset?: number; limit?: number; order?: 'active' | 'new'; local?: boolean } = {}
): Promise<MastodonAccount[]> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/directory', {
    limit: String(options.limit ?? 40),
    offset: options.offset ? String(options.offset) : undefined,
    order: options.order,
    local: options.local ? 'true' : undefined,
  });
  return (raw || []).map(a => mapAccount(a, instanceUrl));
}

/**
 * Look up a single hashtag, including whether you follow it.
 *
 * Tag endpoints are keyed on the tag's **name**, not an id, and are
 * case-insensitive.
 */
export async function getTag(name: string): Promise<MastodonTag> {
  const raw = await get<any>(`/api/v1/tags/${encodeURIComponent(name)}`);
  return mapTag(raw);
}

/**
 * Follow a hashtag, which mixes its posts into your home timeline.
 * Idempotent since Mastodon 4.1.
 */
export async function followTag(name: string): Promise<MastodonTag> {
  const raw = await post<any>(`/api/v1/tags/${encodeURIComponent(name)}/follow`, {});
  return mapTag(raw);
}

export async function unfollowTag(name: string): Promise<MastodonTag> {
  const raw = await post<any>(`/api/v1/tags/${encodeURIComponent(name)}/unfollow`, {});
  return mapTag(raw);
}

/**
 * Hashtags you follow.
 */
export async function getFollowedTags(): Promise<MastodonTag[]> {
  const raw = await get<any[]>('/api/v1/followed_tags', { limit: '100' });
  return (raw || []).map(mapTag);
}
