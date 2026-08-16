export {
  configureNotificationHandler,
  initialiseNotifications,
  requestNotificationPermission,
  getPermissionState,
  clearBadge,
  type PermissionState,
} from './setup';

export { registerChannels, channelId, CHANNEL_VERSION, type ChannelKey } from './channels';

export { checkForNewNotifications } from './poller';

export {
  registerBackgroundCheck,
  unregisterBackgroundCheck,
  NOTIFICATION_TASK,
} from './background';

export {
  getNotificationPreferences,
  setNotificationPreferences,
  getLastSeenNotificationId,
  setLastSeenNotificationId,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from './storage';

export { playInAppSound, SOUNDS, IN_APP_SOUNDS, type InAppSound } from './sounds';
