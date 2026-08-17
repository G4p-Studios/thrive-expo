import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { primeCurrentAccount } from '@/lib/mastodon';
import { checkForNewNotifications } from './poller';
import { initialiseNotifications, getPermissionState } from './setup';
import { registerBackgroundCheck } from './background';
import { getNotificationPreferences } from './storage';

/** How often to look for new notifications while the app is on screen. */
const FOREGROUND_INTERVAL_MS = 60_000;

/**
 * Keep notifications flowing and route taps to the right screen.
 *
 * Mounted once from the root layout. While the app is on screen this polls
 * every minute; the background task covers the rest, on the operating system's
 * schedule rather than ours.
 */
export function useNotifications(): void {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handler and channels, plus the background task if it is wanted.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Needed by the mention earcon, which cannot await inside a handler.
      await primeCurrentAccount();
      await initialiseNotifications();
      if (cancelled) return;

      const [permission, preferences] = await Promise.all([
        getPermissionState(),
        getNotificationPreferences(),
      ]);
      if (cancelled) return;

      if (permission === 'granted' && preferences.enabled) {
        await registerBackgroundCheck();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Poll while the app is in the foreground, and once immediately on return —
  // coming back to the app is exactly when someone expects to see what is new.
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) return;
      checkForNewNotifications().catch(() => {});
      intervalRef.current = setInterval(() => {
        checkForNewNotifications().catch(() => {});
      }, FOREGROUND_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleChange = (state: AppStateStatus) => {
      if (state === 'active') startPolling();
      else stopPolling();
    };

    if (AppState.currentState === 'active') startPolling();
    const subscription = AppState.addEventListener('change', handleChange);

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, []);

  // Tapping a notification should land on the thing it is about.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as {
        statusId?: string;
        accountId?: string;
      };

      if (data?.statusId) {
        router.push(`/post/${data.statusId}` as any);
      } else if (data?.accountId) {
        router.push(`/account/${data.accountId}` as any);
      }
    });

    return () => subscription.remove();
  }, [router]);
}
