import { get, patch, post, getPaginated, type PageCursor } from '../client';
import { mapAccount, mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonAccount, MastodonPost } from '@/types/mastodon';

/**
 * What the server does with a notification from somebody in a given category.
 *
 * - `accept` — deliver it normally.
 * - `filter` — hold it in the requests inbox for review instead of notifying.
 * - `drop`   — discard it silently; it is never shown anywhere.
 */
export type NotificationPolicyAction = 'accept' | 'filter' | 'drop';

export interface NotificationPolicy {
  /** People you do not follow. */
  forNotFollowing: NotificationPolicyAction;
  /** People who do not follow you. */
  forNotFollowers: NotificationPolicyAction;
  /** Accounts created very recently — the usual shape of a spam wave. */
  forNewAccounts: NotificationPolicyAction;
  /**
   * Private mentions from people you do not follow. Defaults to `filter`,
   * because an unsolicited private mention is the most common harassment
   * vector on the network.
   */
  forPrivateMentions: NotificationPolicyAction;
  /** Accounts limited by your server's moderators. */
  forLimitedAccounts: NotificationPolicyAction;
  /** How much is currently held back, for badging the requests inbox. */
  pendingRequestsCount: number;
  pendingNotificationsCount: number;
}

function mapPolicy(raw: any): NotificationPolicy {
  const action = (value: any): NotificationPolicyAction =>
    value === 'filter' || value === 'drop' ? value : 'accept';

  return {
    forNotFollowing: action(raw?.for_not_following),
    forNotFollowers: action(raw?.for_not_followers),
    forNewAccounts: action(raw?.for_new_accounts),
    forPrivateMentions: action(raw?.for_private_mentions),
    forLimitedAccounts: action(raw?.for_limited_accounts),
    pendingRequestsCount: raw?.summary?.pending_requests_count ?? 0,
    pendingNotificationsCount: raw?.summary?.pending_notifications_count ?? 0,
  };
}

/**
 * The account's notification filtering policy.
 *
 * Added in Mastodon 4.3; older servers answer 404, which callers should read as
 * "this server cannot filter" and hide the settings rather than show an error.
 */
export async function getNotificationPolicy(): Promise<NotificationPolicy> {
  const raw = await get<any>('/api/v2/notifications/policy');
  return mapPolicy(raw);
}

export interface NotificationPolicyUpdate {
  forNotFollowing?: NotificationPolicyAction;
  forNotFollowers?: NotificationPolicyAction;
  forNewAccounts?: NotificationPolicyAction;
  forPrivateMentions?: NotificationPolicyAction;
  forLimitedAccounts?: NotificationPolicyAction;
}

/**
 * Change the filtering policy. Only the categories passed are touched.
 */
export async function updateNotificationPolicy(
  update: NotificationPolicyUpdate
): Promise<NotificationPolicy> {
  const body: Record<string, unknown> = {};
  if (update.forNotFollowing) body.for_not_following = update.forNotFollowing;
  if (update.forNotFollowers) body.for_not_followers = update.forNotFollowers;
  if (update.forNewAccounts) body.for_new_accounts = update.forNewAccounts;
  if (update.forPrivateMentions) body.for_private_mentions = update.forPrivateMentions;
  if (update.forLimitedAccounts) body.for_limited_accounts = update.forLimitedAccounts;

  const raw = await patch<any>('/api/v2/notifications/policy', body);
  return mapPolicy(raw);
}

/**
 * Notifications held back by the policy, grouped by who sent them.
 *
 * This is the review queue: nothing here has been shown as a notification, and
 * it stays hidden until the sender is accepted or the request is dismissed.
 */
export interface NotificationRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
  account: MastodonAccount;
  /** How many notifications from this account are waiting. */
  notificationsCount: number;
  /** The most recent post involved, for previewing what they wanted. */
  lastStatus?: MastodonPost;
}

function mapRequest(raw: any, instanceUrl: string): NotificationRequest {
  return {
    id: String(raw.id),
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
    account: mapAccount(raw.account, instanceUrl),
    // The server sends this as a string.
    notificationsCount: Number(raw.notifications_count ?? 0),
    lastStatus: raw.last_status ? mapPost(raw.last_status, instanceUrl) : undefined,
  };
}

export async function getNotificationRequests(
  cursor?: PageCursor | null
): Promise<{ requests: NotificationRequest[]; next: PageCursor | null }> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>('/api/v1/notifications/requests', {
    limit: '40',
    ...(cursor ?? {}),
  });
  return { requests: (items || []).map(r => mapRequest(r, instanceUrl)), next };
}

export async function getNotificationRequest(
  requestId: string
): Promise<NotificationRequest> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>(
    `/api/v1/notifications/requests/${encodeURIComponent(requestId)}`
  );
  return mapRequest(raw, instanceUrl);
}

/**
 * Accept a request: the held notifications are merged into the main list and
 * this account stops being filtered.
 *
 * The merge is asynchronous — see {@link areNotificationRequestsMerged} before
 * assuming a reloaded notification list will contain them.
 */
export async function acceptNotificationRequest(requestId: string): Promise<void> {
  await post<any>(
    `/api/v1/notifications/requests/${encodeURIComponent(requestId)}/accept`,
    {}
  );
}

/**
 * Dismiss a request. The held notifications are discarded and the sender is
 * not told.
 */
export async function dismissNotificationRequest(requestId: string): Promise<void> {
  await post<any>(
    `/api/v1/notifications/requests/${encodeURIComponent(requestId)}/dismiss`,
    {}
  );
}

/**
 * Accept several requests in one call.
 *
 * The array goes in a JSON body as a plain `id` array — the `id[]` spelling in
 * the docs is the form-encoded equivalent, and sending that literal key with
 * JSON would have the server look for a parameter named `id[]`.
 */
export async function acceptNotificationRequests(requestIds: string[]): Promise<void> {
  if (!requestIds.length) return;
  await post<any>('/api/v1/notifications/requests/accept', { id: requestIds });
}

export async function dismissNotificationRequests(requestIds: string[]): Promise<void> {
  if (!requestIds.length) return;
  await post<any>('/api/v1/notifications/requests/dismiss', { id: requestIds });
}

/**
 * Whether accepted notifications have finished merging into the main list.
 *
 * Accepting queues background work. Refreshing before it finishes shows a list
 * that is missing the notifications the user just accepted, which reads as the
 * accept having failed — so poll this before refreshing.
 */
export async function areNotificationRequestsMerged(): Promise<boolean> {
  const raw = await get<{ merged?: boolean }>('/api/v1/notifications/requests/merged');
  return !!raw?.merged;
}
