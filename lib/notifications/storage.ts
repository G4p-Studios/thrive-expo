import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  LAST_SEEN: 'thrive_last_seen_notification',
  PREFERENCES: 'thrive_notification_preferences',
} as const;

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.warn(`[Notifications] Could not save ${key}:`, error);
  }
}

/**
 * The newest notification id already shown, so a poll only announces what
 * arrived since. Written even when nothing is shown, to avoid re-checking the
 * same batch forever.
 */
export async function getLastSeenNotificationId(): Promise<string | null> {
  return getItem(KEYS.LAST_SEEN);
}

export async function setLastSeenNotificationId(id: string): Promise<void> {
  await setItem(KEYS.LAST_SEEN, id);
}

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  /** Per Mastodon notification type. Absent means allowed. */
  types: Record<string, boolean>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  sound: true,
  types: {
    mention: true,
    reblog: true,
    favourite: true,
    follow: true,
    follow_request: true,
    poll: true,
    update: true,
    status: false,
  },
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const stored = await getItem(KEYS.PREFERENCES);
  if (!stored) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const parsed = JSON.parse(stored);
    // Merge rather than replace, so a type added in a later version keeps its
    // default instead of arriving switched off.
    return {
      enabled: parsed.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      sound: parsed.sound ?? DEFAULT_NOTIFICATION_PREFERENCES.sound,
      types: { ...DEFAULT_NOTIFICATION_PREFERENCES.types, ...(parsed.types ?? {}) },
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function setNotificationPreferences(
  preferences: NotificationPreferences
): Promise<void> {
  await setItem(KEYS.PREFERENCES, JSON.stringify(preferences));
}
