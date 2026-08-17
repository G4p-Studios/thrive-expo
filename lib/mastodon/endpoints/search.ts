import { get } from '../client';
import { mapSearchResponse } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { SearchResponse } from '@/types/mastodon';

export interface SearchOptions {
  type?: 'accounts' | 'statuses' | 'hashtags';
  /**
   * Fetch an account or status the server has never seen.
   *
   * Without this, pasting a full `@user@domain` handle for somebody your
   * server does not know about returns nothing. Ignored unless authenticated.
   */
  resolve?: boolean;
  /** Restrict account results to people you follow. */
  following?: boolean;
  /** Only statuses by this account. */
  accountId?: string;
  /** Skip the first n results — search pages by offset, not by id. */
  offset?: number;
  limit?: number;
}

/**
 * Search for accounts, statuses, and hashtags
 */
export async function search(
  query: string,
  options: SearchOptions | 'accounts' | 'statuses' | 'hashtags' = {}
): Promise<SearchResponse> {
  const instanceUrl = await getInstanceUrl() || '';

  // Callers used to pass the type directly; keep that working.
  const resolved: SearchOptions = typeof options === 'string' ? { type: options } : options;

  // A query that looks like a handle or a URL is exactly the case `resolve`
  // exists for, so default it on there and when explicitly searching accounts.
  const looksRemote = /^@|^https?:\/\//.test(query.trim());
  const shouldResolve = resolved.resolve ?? (resolved.type === 'accounts' || looksRemote);

  const raw = await get<any>('/api/v2/search', {
    q: query,
    type: resolved.type,
    resolve: shouldResolve ? 'true' : undefined,
    following: resolved.following ? 'true' : undefined,
    account_id: resolved.accountId,
    offset: resolved.offset ? String(resolved.offset) : undefined,
    limit: String(resolved.limit ?? 20),
  });

  return mapSearchResponse(raw, instanceUrl);
}
