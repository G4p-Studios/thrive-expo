import * as Notifications from 'expo-notifications';
import { getNotifications, isAuthenticated } from '@/lib/mastodon';
import type { MastodonNotification } from '@/types/mastodon';
import { channelId, type ChannelKey } from './channels';
import { SOUNDS } from './sounds';
import {
  getLastSeenNotificationId,
  setLastSeenNotificationId,
  getNotificationPreferences,
} from './storage';

/** Never raise more than this many at once, however long the app was closed. */
const MAX_NOTIFICATIONS_PER_CHECK = 5;

/**
 * Which Android channel — and therefore which sound and importance — a
 * notification type belongs to.
 */
function channelFor(type: string): ChannelKey {
  switch (type) {
    case 'mention':
      return 'mentions';
    case 'follow':
    case 'follow_request':
    case 'favourite':
    case 'reblog':
      return 'social';
    default:
      return 'updates';
  }
}

function soundFor(key: ChannelKey): string | undefined {
  return key === 'mentions' ? SOUNDS.mention : key === 'social' ? SOUNDS.social : SOUNDS.update;
}

/** Strip HTML and clip, so a notification body is one readable line. */
function preview(text: string | undefined, limit = 120): string {
  if (!text) return '';
  const plain = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

function describe(notification: MastodonNotification): { title: string; body: string } {
  const who = notification.account.displayName || notification.account.username;
  const content = preview(notification.status?.content);

  switch (notification.type) {
    case 'mention':
      return { title: `${who} mentioned you`, body: content };
    case 'reblog':
      return { title: `${who} boosted your post`, body: content };
    case 'favourite':
      return { title: `${who} liked your post`, body: content };
    case 'follow':
      return { title: `${who} followed you`, body: '' };
    case 'follow_request':
      return { title: `${who} asked to follow you`, body: '' };
    case 'poll':
      return { title: 'A poll ended', body: content };
    case 'update':
      return { title: `${who} edited a post`, body: content };
    case 'status':
      return { title: `${who} posted`, body: content };
    default:
      return { title: who, body: content };
  }
}

/**
 * Check for new Mastodon notifications and raise a local one for each.
 *
 * Mastodon delivers notifications over Web Push, which needs a relay server to
 * reach APNs or FCM — see lib/mastodon/endpoints/push.ts. Until one exists,
 * this poll is what makes notifications appear: promptly while the app is open,
 * and on the operating system's schedule in the background.
 *
 * @returns how many notifications were raised.
 */
export async function checkForNewNotifications(): Promise<number> {
  if (!(await isAuthenticated())) return 0;

  const preferences = await getNotificationPreferences();
  if (!preferences.enabled) return 0;

  const lastSeenId = await getLastSeenNotificationId();

  let response;
  try {
    response = await getNotifications();
  } catch (error) {
    console.warn('[Notifications] Poll failed:', error);
    return 0;
  }

  const all = response.notifications;
  if (all.length === 0) return 0;

  // The newest is first. Remember it regardless of what we show, so a filtered
  // batch does not get re-examined forever.
  const newestId = all[0].id;

  // First run: record where we are rather than announcing the entire backlog.
  if (!lastSeenId) {
    await setLastSeenNotificationId(newestId);
    return 0;
  }

  if (newestId === lastSeenId) return 0;

  // Ids are sortable, so everything above the last seen one is new.
  const fresh = all.filter(n => n.id > lastSeenId && preferences.types[n.type] !== false);

  await setLastSeenNotificationId(newestId);
  if (fresh.length === 0) return 0;

  // Oldest first so they stack in a sensible order, and capped so a week away
  // does not produce a wall of them.
  const toShow = fresh.slice(0, MAX_NOTIFICATIONS_PER_CHECK).reverse();

  for (const notification of toShow) {
    const key = channelFor(notification.type);
    const { title, body } = describe(notification);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: preferences.sound ? (soundFor(key) ?? 'default') : undefined,
          data: {
            notificationType: notification.type,
            statusId: notification.status?.id,
            accountId: notification.account.id,
          },
        },
        // null means deliver now rather than on a schedule.
        trigger: null,
      });
    } catch (error) {
      console.warn('[Notifications] Could not present a notification:', error);
    }
  }

  if (fresh.length > toShow.length) {
    const extra = fresh.length - toShow.length;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${extra} more ${extra === 1 ? 'notification' : 'notifications'}`,
          body: 'Open Thrive to catch up.',
          sound: undefined,
        },
        trigger: null,
      });
    } catch {
      // Best effort.
    }
  }

  return toShow.length;
}

/** Android channel id for a notification type, exported for testing. */
export const channelIdFor = (type: string) => channelId(channelFor(type));
export { channelFor, describe as describeNotification, preview as previewText };
