import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SOUNDS } from './sounds';

/**
 * Bump this whenever a channel's sound, importance or vibration changes.
 *
 * Android freezes a notification channel's settings when it is first created.
 * Passing a different `sound` later is silently ignored on any device that
 * already has the channel, so the only way to change one is to create a new
 * channel — hence the version in the id. The previous version is deleted on the
 * next launch so the user's notification settings screen does not fill up with
 * dead channels.
 */
export const CHANNEL_VERSION = 1;

export type ChannelKey = 'mentions' | 'social' | 'updates';

interface ChannelSpec {
  key: ChannelKey;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
  sound?: string;
}

/**
 * Separate channels let people silence boosts without losing mentions, which is
 * the main thing Android's notification settings are good for.
 */
const CHANNEL_SPECS: ChannelSpec[] = [
  {
    key: 'mentions',
    name: 'Mentions and replies',
    description: 'When somebody mentions you or replies to your post',
    importance: Notifications.AndroidImportance.HIGH,
    sound: SOUNDS.mention,
  },
  {
    key: 'social',
    name: 'Boosts, likes and follows',
    description: 'When somebody boosts, likes or follows you',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: SOUNDS.social,
  },
  {
    key: 'updates',
    name: 'Polls and edits',
    description: 'When a poll you voted in ends, or a post you saw is edited',
    importance: Notifications.AndroidImportance.LOW,
    sound: SOUNDS.update,
  },
];

/** The channel id actually registered with Android, including its version. */
export function channelId(key: ChannelKey): string {
  return `${key}-v${CHANNEL_VERSION}`;
}

/**
 * Create the notification channels, and clean up the previous version's.
 *
 * No-ops on iOS, which has no channel concept — there, sound and importance are
 * set per notification instead.
 */
export async function registerChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  for (const spec of CHANNEL_SPECS) {
    await Notifications.setNotificationChannelAsync(channelId(spec.key), {
      name: spec.name,
      description: spec.description,
      importance: spec.importance,
      // `undefined` means the system default sound; a filename means a bundled
      // one, which only exists if it was listed in the app.json plugin config.
      sound: spec.sound,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6364FF',
    });
  }

  if (CHANNEL_VERSION > 1) {
    for (const spec of CHANNEL_SPECS) {
      await Notifications.deleteNotificationChannelAsync(
        `${spec.key}-v${CHANNEL_VERSION - 1}`
      ).catch(() => {
        // Nothing to delete on a fresh install.
      });
    }
  }
}
