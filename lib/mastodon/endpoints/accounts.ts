import { get, post } from '../client';
import { mapAccount, mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonAccount, MastodonPost } from '@/types/mastodon';

/**
 * Verify credentials and get the current user's account
 */
export async function verifyCredentials(): Promise<MastodonAccount> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>('/api/v1/accounts/verify_credentials');
  return mapAccount(raw, instanceUrl);
}

/**
 * Get a specific account by ID
 */
export async function getAccount(accountId: string): Promise<MastodonAccount> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);
  return mapAccount(raw, instanceUrl);
}

interface AccountStatusesResponse {
  posts: MastodonPost[];
  nextMaxId: string | null;
}

/**
 * Get statuses posted by a specific account
 */
export async function getAccountStatuses(
  accountId: string,
  maxId?: string
): Promise<AccountStatusesResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`, {
    max_id: maxId,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}

interface FollowResult {
  following: boolean;
}

/**
 * Follow an account
 */
export async function follow(accountId: string): Promise<FollowResult> {
  await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/follow`, {});
  return { following: true };
}

/**
 * Unfollow an account
 */
export async function unfollow(accountId: string): Promise<FollowResult> {
  await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unfollow`, {});
  return { following: false };
}

interface BookmarksResponse {
  posts: MastodonPost[];
  nextMaxId: string | null;
}

/**
 * Get bookmarked posts
 */
export async function getBookmarks(maxId?: string): Promise<BookmarksResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/bookmarks', {
    max_id: maxId,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}
