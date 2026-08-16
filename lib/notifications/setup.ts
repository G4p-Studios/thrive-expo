import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerChannels } from './channels';

/**
 * Decide what happens when a notification arrives while Thrive is open.
 *
 * Set once at module load, before any listener can fire. `shouldShowBanner` and
 * `shouldShowList` replaced the older single `shouldShowAlert` flag and control
 * the heads-up banner and the notification centre entry separately.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  // iOS reports provisional and ephemeral authorisations that `granted` alone
  // misses, so read the iOS status directly where it exists.
  if (Platform.OS === 'ios') {
    const iosStatus = status.ios?.status;
    if (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'granted';
    }
    if (iosStatus === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
    return status.granted ? 'granted' : 'undetermined';
  }

  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch (error) {
    console.warn('[Notifications] Could not read permissions:', error);
    return 'undetermined';
  }
}

/**
 * Ask for notification permission, and set up channels if it is granted.
 *
 * Only ever prompts once per install — the OS ignores later requests — so this
 * should be called from a point where the reason is obvious to the user, not on
 * first launch.
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    const status = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    const state = toState(status);
    if (state === 'granted') await registerChannels();
    return state;
  } catch (error) {
    console.warn('[Notifications] Permission request failed:', error);
    return 'denied';
  }
}

/**
 * Prepare notifications at app start.
 *
 * Registers channels only if permission already exists, so a fresh install does
 * not get a permission prompt before the user has seen anything.
 */
export async function initialiseNotifications(): Promise<void> {
  configureNotificationHandler();

  if ((await getPermissionState()) === 'granted') {
    await registerChannels();
  }
}

/** Clear the badge, e.g. when the notifications tab is opened. */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Not supported everywhere; harmless.
  }
}
