import { get, post, getPaginated, type PageCursor } from '../client';
import { mapNotification } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonNotification } from '@/types/mastodon';

interface NotificationsResponse {
  notifications: MastodonNotification[];
  /** Cursor for the next (older) page, from the `Link` header. */
  next: PageCursor | null;
  /** @deprecated Prefer `next`. */
  nextMaxId: string | null;
}

export interface NotificationFilter {
  /** Only these types. Mutually exclusive with `excludeTypes`. */
  types?: string[];
  /** Everything except these types — how "hide boosts" is expressed. */
  excludeTypes?: string[];
  /** Only notifications from one account. */
  accountId?: string;
}

/**
 * Turn a filter into repeated bracketed query parameters, which is how Rails
 * expects arrays in a query string.
 */
function filterToParams(filter: NotificationFilter): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  filter.types?.forEach((type, index) => {
    params[`types[${index}]`] = type;
  });
  filter.excludeTypes?.forEach((type, index) => {
    params[`exclude_types[${index}]`] = type;
  });
  if (filter.accountId) params.account_id = filter.accountId;

  return params;
}

/**
 * Get notifications
 */
export async function getNotifications(
  cursor?: PageCursor | string | null,
  filter: NotificationFilter = {}
): Promise<NotificationsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const resolved = typeof cursor === 'string' ? { max_id: cursor } : (cursor ?? null);

  const { items, next } = await getPaginated<any[]>('/api/v1/notifications', {
    limit: '20',
    ...filterToParams(filter),
    ...(resolved ?? {}),
  });

  const notifications = (items || []).map(n => mapNotification(n, instanceUrl));

  return {
    notifications,
    next,
    nextMaxId: notifications.length > 0 ? notifications[notifications.length - 1].id : null,
  };
}

/**
 * How many unread notifications there are, capped by the server.
 *
 * Counted against the notifications read marker. Added in Mastodon 4.3, so
 * older servers answer 404.
 */
export async function getUnreadNotificationCount(
  filter: NotificationFilter = {}
): Promise<number> {
  const raw = await get<{ count?: number }>('/api/v1/notifications/unread_count', {
    ...filterToParams(filter),
  });
  return raw?.count ?? 0;
}

/**
 * Clear all notifications
 */
export async function clearNotifications(): Promise<void> {
  await post<any>('/api/v1/notifications/clear', {});
}

/**
 * Dismiss a single notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  await post<any>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/dismiss`, {});
}

/**
 * Get a single notification by ID
 */
export async function getNotification(notificationId: string): Promise<MastodonNotification> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`);
  return mapNotification(raw, instanceUrl);
}
