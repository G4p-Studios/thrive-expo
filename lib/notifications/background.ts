import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { checkForNewNotifications } from './poller';

export const NOTIFICATION_TASK = 'thrive-notification-check';

/**
 * How often to ask the system to run the check, in minutes.
 *
 * This is a *request*, not a schedule. Android will not run it more often than
 * every 15 minutes, and iOS decides for itself based on how the person uses the
 * app — it may be far less often, and never while the device is low on battery.
 * Notifications from this route are therefore delayed, not instant; only a push
 * relay can make them immediate.
 */
const INTERVAL_MINUTES = 15;

// Registering the handler at module scope is required: the system can start the
// app directly into this task, with no screen ever mounting.
TaskManager.defineTask(NOTIFICATION_TASK, async () => {
  try {
    const shown = await checkForNewNotifications();
    return shown > 0
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('[Notifications] Background check failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundCheck(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn('[Notifications] Background tasks are restricted on this device');
      return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(NOTIFICATION_TASK);
    if (alreadyRegistered) return;

    await BackgroundTask.registerTaskAsync(NOTIFICATION_TASK, {
      minimumInterval: INTERVAL_MINUTES,
    });
  } catch (error) {
    console.warn('[Notifications] Could not register the background check:', error);
  }
}

export async function unregisterBackgroundCheck(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(NOTIFICATION_TASK)) {
      await BackgroundTask.unregisterTaskAsync(NOTIFICATION_TASK);
    }
  } catch (error) {
    console.warn('[Notifications] Could not unregister the background check:', error);
  }
}
