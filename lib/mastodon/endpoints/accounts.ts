import { get, post, patch } from '../client';
import { mapAccount, mapPost } from '../mappers';
import { getInstanceUrl, setAccountCache } from '../storage';
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

export interface UpdateCredentialsData {
  displayName?: string;
  note?: string;
  avatar?: string; // base64 data URI
  header?: string; // base64 data URI
  locked?: boolean;
  discoverable?: boolean;
  bot?: boolean;
}

/**
 * Update the current user's profile/credentials
 * Supports updating display name, bio, avatar, header, and boolean flags
 */
export async function updateCredentials(data: UpdateCredentialsData): Promise<MastodonAccount> {
  const instanceUrl = await getInstanceUrl() || '';

  // Convert camelCase to snake_case for the API
  const body: Record<string, unknown> = {};

  if (data.displayName !== undefined) {
    body.display_name = data.displayName;
  }
  if (data.note !== undefined) {
    body.note = data.note;
  }
  if (data.avatar !== undefined) {
    body.avatar = data.avatar;
  }
  if (data.header !== undefined) {
    body.header = data.header;
  }
  if (data.locked !== undefined) {
    body.locked = data.locked;
  }
  if (data.discoverable !== undefined) {
    body.discoverable = data.discoverable;
  }
  if (data.bot !== undefined) {
    body.bot = data.bot;
  }

  const raw = await patch<any>('/api/v1/accounts/update_credentials', body);
  const account = mapAccount(raw, instanceUrl);

  // Update the cached account data
  await setAccountCache(account);

  return account;
}
