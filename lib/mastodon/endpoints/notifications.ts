import { get, post } from '../client';
import { mapNotification } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonNotification } from '@/types/mastodon';

interface NotificationsResponse {
  notifications: MastodonNotification[];
  nextMaxId: string | null;
}

/**
 * Get notifications
 */
export async function getNotifications(maxId?: string): Promise<NotificationsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/notifications', {
    max_id: maxId,
    limit: '20',
  });

  const notifications = raw.map((n) => mapNotification(n, instanceUrl));
  const nextMaxId = notifications.length > 0 ? notifications[notifications.length - 1].id : null;

  return { notifications, nextMaxId };
}

/**
 * Clear all notifications
 */
export async function clearNotifications(): Promise<void> {
  await post<any>('/api/v1/notifications/clear', {});
}
