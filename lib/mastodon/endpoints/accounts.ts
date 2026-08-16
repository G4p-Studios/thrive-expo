import { get, post, patch, getPaginated, type PageCursor } from '../client';
import { mapAccount, mapPost, mapRelationship } from '../mappers';
import { getInstanceUrl, setAccountCache } from '../storage';
import type { MastodonAccount, MastodonPost, MastodonRelationship } from '@/types/mastodon';

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

/**
 * Follow an account.
 *
 * Returns the server's relationship rather than assuming success: following a
 * `locked` account creates a *request*, which comes back as `requested: true`
 * with `following` still false.
 */
export async function follow(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/follow`, {});
  return mapRelationship(raw);
}

/**
 * Unfollow an account. Also withdraws a pending follow request.
 */
export async function unfollow(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unfollow`, {});
  return mapRelationship(raw);
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

/**
 * Block an account
 */
export async function blockAccount(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/block`, {});
  return mapRelationship(raw);
}

/**
 * Unblock an account
 */
export async function unblockAccount(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unblock`, {});
  return mapRelationship(raw);
}

/**
 * Mute an account
 */
export async function muteAccount(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/mute`, {});
  return mapRelationship(raw);
}

/**
 * Unmute an account
 */
export async function unmuteAccount(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unmute`, {});
  return mapRelationship(raw);
}

interface PaginatedAccountsResponse {
  accounts: MastodonAccount[];
  nextMaxId: string | null;
}

/**
 * Get an account's followers
 */
export async function getFollowers(accountId: string, maxId?: string): Promise<PaginatedAccountsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/accounts/${encodeURIComponent(accountId)}/followers`, {
    max_id: maxId,
    limit: '40',
  });
  const accounts = raw.map((a) => mapAccount(a, instanceUrl));
  const nextMaxId = accounts.length > 0 ? accounts[accounts.length - 1].id : null;
  return { accounts, nextMaxId };
}

/**
 * Get accounts that the specified account follows
 */
export async function getFollowing(accountId: string, maxId?: string): Promise<PaginatedAccountsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/accounts/${encodeURIComponent(accountId)}/following`, {
    max_id: maxId,
    limit: '40',
  });
  const accounts = raw.map((a) => mapAccount(a, instanceUrl));
  const nextMaxId = accounts.length > 0 ? accounts[accounts.length - 1].id : null;
  return { accounts, nextMaxId };
}

/**
 * Get relationships with one or more accounts
 */
export async function getRelationships(accountIds: string[]): Promise<MastodonRelationship[]> {
  const params: Record<string, string> = {};
  accountIds.forEach((id, index) => {
    params[`id[${index}]`] = id;
  });
  const raw = await get<any[]>('/api/v1/accounts/relationships', params);
  return raw.map(mapRelationship);
}

export interface CursorAccountsResponse {
  accounts: MastodonAccount[];
  /** Pass back to load the next page; null once the list is exhausted. */
  next: PageCursor | null;
}

/**
 * Fetch a collection of accounts that paginates on ids we never see.
 *
 * Blocks, mutes and follow requests are keyed server-side on the block/mute/
 * request record, not on the account — so the last account's `id` is the wrong
 * cursor and the `Link` header is the only correct way through the list.
 */
async function getAccountCollection(
  endpoint: string,
  cursor?: PageCursor | null
): Promise<CursorAccountsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(endpoint, {
    limit: '40',
    ...(cursor ?? {}),
  });

  return {
    accounts: (items || []).map(a => mapAccount(a, instanceUrl)),
    next,
  };
}

/**
 * Accounts you have blocked.
 */
export async function getBlockedAccounts(cursor?: PageCursor | null): Promise<CursorAccountsResponse> {
  return getAccountCollection('/api/v1/blocks', cursor);
}

/**
 * Accounts you have muted.
 */
export async function getMutedAccounts(cursor?: PageCursor | null): Promise<CursorAccountsResponse> {
  return getAccountCollection('/api/v1/mutes', cursor);
}

/**
 * People waiting for you to approve their follow.
 *
 * Only ever non-empty for accounts with `locked` set, since an unlocked
 * account approves followers automatically.
 */
export async function getFollowRequests(cursor?: PageCursor | null): Promise<CursorAccountsResponse> {
  return getAccountCollection('/api/v1/follow_requests', cursor);
}

/**
 * Approve a follow request. Keyed on the requesting account's id.
 */
export async function authorizeFollowRequest(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(
    `/api/v1/follow_requests/${encodeURIComponent(accountId)}/authorize`,
    {}
  );
  return mapRelationship(raw);
}

/**
 * Decline a follow request. The requester is not notified.
 */
export async function rejectFollowRequest(accountId: string): Promise<MastodonRelationship> {
  const raw = await post<any>(
    `/api/v1/follow_requests/${encodeURIComponent(accountId)}/reject`,
    {}
  );
  return mapRelationship(raw);
}

interface FavouritesResponse {
  posts: MastodonPost[];
  nextMaxId: string | null;
}

/**
 * Get favourited posts
 */
export async function getFavourites(maxId?: string): Promise<FavouritesResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/favourites', {
    max_id: maxId,
    limit: '20',
  });
  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;
  return { posts, nextMaxId };
}
