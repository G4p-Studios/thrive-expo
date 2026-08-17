import { get, post, getPaginated, type PageCursor } from '../client';
import { mapAccount, mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonAccount, MastodonPost } from '@/types/mastodon';
import type { NotificationFilter } from './notifications';

/**
 * A run of notifications the server has collapsed into one.
 *
 * Thirty people favouriting the same post is one event to a reader, not thirty.
 * The ungrouped `/api/v1/notifications` list makes that unreadable — especially
 * with a screen reader, where every duplicate has to be spoken past.
 */
export interface NotificationGroup {
  /**
   * Opaque server-assigned identity for the group. Every group-scoped endpoint
   * is keyed on this, *not* on a notification id. Ungrouped notifications get
   * one of these too, so callers never need a separate path for them.
   */
  groupKey: string;
  /** How many notifications were collapsed — including ones off this page. */
  notificationsCount: number;
  type: string;
  createdAt: string;
  /** Accounts involved, already resolved from the response's shared pool. */
  accounts: MastodonAccount[];
  /** The post being favourited, boosted or replied to, where there is one. */
  status?: MastodonPost;
  mostRecentNotificationId: string;
}

interface GroupedNotificationsResponse {
  groups: NotificationGroup[];
  next: PageCursor | null;
}

export interface GroupedNotificationOptions extends NotificationFilter {
  /**
   * Which types the server may collapse. Defaults to the types where grouping
   * is unambiguously wanted; mentions are deliberately absent, since each one
   * carries its own text and collapsing them would hide what was said.
   */
  groupedTypes?: string[];
  limit?: number;
}

const DEFAULT_GROUPED_TYPES = ['favourite', 'reblog', 'follow'];

function filterToParams(
  options: GroupedNotificationOptions
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  options.types?.forEach((type, index) => {
    params[`types[${index}]`] = type;
  });
  options.excludeTypes?.forEach((type, index) => {
    params[`exclude_types[${index}]`] = type;
  });
  (options.groupedTypes ?? DEFAULT_GROUPED_TYPES).forEach((type, index) => {
    params[`grouped_types[${index}]`] = type;
  });
  if (options.accountId) params.account_id = options.accountId;

  return params;
}

/**
 * Grouped notifications, with the server's normalised response flattened back
 * out into self-contained groups.
 *
 * The response arrives normalised — groups reference accounts and statuses by
 * id, and the entities themselves sit in shared top-level arrays. Every caller
 * would otherwise have to rebuild the same two lookup tables, so this does it
 * once here.
 *
 * Added in Mastodon 4.3. Servers older than that answer 404, which callers
 * should treat as "fall back to {@link getNotifications}" rather than an error.
 */
export async function getGroupedNotifications(
  cursor?: PageCursor | null,
  options: GroupedNotificationOptions = {}
): Promise<GroupedNotificationsResponse> {
  const instanceUrl = await getInstanceUrl() || '';

  const { items, next } = await getPaginated<any>('/api/v2/notifications', {
    limit: String(options.limit ?? 40),
    ...filterToParams(options),
    ...(cursor ?? {}),
  });

  const accountsById = new Map<string, MastodonAccount>(
    (items?.accounts ?? []).map((a: any) => [String(a.id), mapAccount(a, instanceUrl)])
  );
  const statusesById = new Map<string, MastodonPost>(
    (items?.statuses ?? []).map((s: any) => [String(s.id), mapPost(s, instanceUrl)])
  );

  const groups: NotificationGroup[] = (items?.notification_groups ?? []).map(
    (raw: any) => ({
      groupKey: String(raw.group_key),
      notificationsCount: raw.notifications_count ?? 1,
      type: raw.type ?? '',
      createdAt: raw.latest_page_notification_at ?? '',
      // Dropping unresolved ids rather than faking an account keeps callers
      // from rendering a blank row for somebody the response never described.
      accounts: (raw.sample_account_ids ?? [])
        .map((id: string) => accountsById.get(String(id)))
        .filter((a: MastodonAccount | undefined): a is MastodonAccount => !!a),
      status: raw.status_id ? statusesById.get(String(raw.status_id)) : undefined,
      mostRecentNotificationId: String(raw.most_recent_notification_id ?? ''),
    })
  );

  return { groups, next };
}

/**
 * Dismiss a whole group at once.
 *
 * Dismissing the notifications one by one would take as many requests as there
 * are notifications in the group — which the group exists precisely to hide.
 */
export async function dismissNotificationGroup(groupKey: string): Promise<void> {
  await post<any>(
    `/api/v2/notifications/${encodeURIComponent(groupKey)}/dismiss`,
    {}
  );
}

/**
 * Every account in a group, not just the sample shown in the list.
 *
 * This is what backs "and 27 others" expanding into the full list.
 */
export async function getNotificationGroupAccounts(
  groupKey: string,
  cursor?: PageCursor | null
): Promise<{ accounts: MastodonAccount[]; next: PageCursor | null }> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(
    `/api/v2/notifications/${encodeURIComponent(groupKey)}/accounts`,
    { limit: '40', ...(cursor ?? {}) }
  );
  return { accounts: (items || []).map(a => mapAccount(a, instanceUrl)), next };
}

/**
 * How many unread notification *groups* there are.
 *
 * Deliberately separate from the v1 count: this one matches what a grouped
 * list actually shows, so the badge cannot claim thirty when the screen shows
 * one row.
 */
export async function getUnreadGroupCount(
  options: GroupedNotificationOptions = {}
): Promise<number> {
  const raw = await get<{ count?: number }>('/api/v2/notifications/unread_count', {
    ...filterToParams(options),
  });
  return raw?.count ?? 0;
}
