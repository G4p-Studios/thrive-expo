import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  useColorScheme,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getNotificationPreferences,
  setNotificationPreferences,
  getPermissionState,
  requestNotificationPermission,
  registerBackgroundCheck,
  unregisterBackgroundCheck,
  type NotificationPreferences,
  type PermissionState,
} from '@/lib/notifications';

const TYPES: { key: string; label: string; hint: string }[] = [
  { key: 'mention', label: 'Mentions and replies', hint: 'Somebody mentions you or replies' },
  { key: 'favourite', label: 'Likes', hint: 'Somebody likes your post' },
  { key: 'reblog', label: 'Boosts', hint: 'Somebody boosts your post' },
  { key: 'follow', label: 'New followers', hint: 'Somebody follows you' },
  { key: 'follow_request', label: 'Follow requests', hint: 'Somebody asks to follow you' },
  { key: 'poll', label: 'Poll results', hint: 'A poll you voted in ends' },
  { key: 'update', label: 'Post edits', hint: 'A post you interacted with is edited' },
  { key: 'status', label: 'New posts', hint: 'Somebody you have notifications on for posts' },
];

export default function NotificationSettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [prefs, state] = await Promise.all([
        getNotificationPreferences(),
        getPermissionState(),
      ]);
      if (cancelled) return;
      setPreferences(prefs);
      setPermission(state);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: NotificationPreferences) => {
    setPreferences(next);
    await setNotificationPreferences(next);

    // Stop asking the system to wake us if notifications are off entirely.
    if (next.enabled) await registerBackgroundCheck();
    else await unregisterBackgroundCheck();
  }, []);

  const handleEnable = useCallback(async () => {
    setRequesting(true);
    const state = await requestNotificationPermission();
    setPermission(state);
    setRequesting(false);

    if (state === 'granted' && preferences) {
      await save({ ...preferences, enabled: true });
    }
  }, [preferences, save]);

  if (loading || !preferences) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Notifications', headerShown: true, headerBackTitle: 'Back' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  const blocked = permission === 'denied';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Notifications', headerShown: true, headerBackTitle: 'Back' }} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Being straight about what these are and are not */}
        <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <IconSymbol
            ios_icon_name="info.circle"
            android_material_icon_name="info"
            size={20}
            color={theme.textSecondary}
            accessible={false}
          />
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
            Thrive checks for notifications while it is open, and every so often in the background.
            Because of that, ones that arrive while the app is closed can be a few minutes late.
          </Text>
        </View>

        {permission !== 'granted' ? (
          <View style={[styles.permissionCard, { borderColor: theme.border }]}>
            <Text style={[styles.permissionTitle, { color: theme.text }]} accessibilityRole="header">
              {blocked ? 'Notifications are turned off' : 'Turn on notifications'}
            </Text>
            <Text style={[styles.permissionBody, { color: theme.textSecondary }]}>
              {blocked
                ? 'Your device is blocking notifications for Thrive. You can turn them back on in system settings.'
                : 'Thrive needs your permission before it can show you anything.'}
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: theme.primary }]}
              onPress={blocked ? () => Linking.openSettings() : handleEnable}
              disabled={requesting}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={blocked ? 'Open system settings' : 'Allow notifications'}
              accessibilityState={{ disabled: requesting }}
            >
              {requesting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.permissionButtonText}>
                  {blocked ? 'Open settings' : 'Allow notifications'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Notifications</Text>
            <Text style={[styles.rowHint, { color: theme.textSecondary }]}>
              Show notifications from your Mastodon account
            </Text>
          </View>
          <Switch
            value={preferences.enabled && permission === 'granted'}
            onValueChange={value => save({ ...preferences, enabled: value })}
            disabled={permission !== 'granted'}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#fff"
            accessible={true}
            accessibilityRole="switch"
            accessibilityLabel="Notifications"
            accessibilityState={{
              checked: preferences.enabled && permission === 'granted',
              disabled: permission !== 'granted',
            }}
          />
        </View>

        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Sound</Text>
            <Text style={[styles.rowHint, { color: theme.textSecondary }]}>
              Play a sound when a notification arrives
            </Text>
          </View>
          <Switch
            value={preferences.sound}
            onValueChange={value => save({ ...preferences, sound: value })}
            disabled={!preferences.enabled || permission !== 'granted'}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#fff"
            accessible={true}
            accessibilityRole="switch"
            accessibilityLabel="Notification sound"
            accessibilityState={{ checked: preferences.sound }}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]} accessibilityRole="header">
          WHAT TO TELL ME ABOUT
        </Text>

        {TYPES.map(type => (
          <View key={type.key} style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{type.label}</Text>
              <Text style={[styles.rowHint, { color: theme.textSecondary }]}>{type.hint}</Text>
            </View>
            <Switch
              value={preferences.types[type.key] !== false}
              onValueChange={value =>
                save({ ...preferences, types: { ...preferences.types, [type.key]: value } })
              }
              disabled={!preferences.enabled || permission !== 'granted'}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel={type.label}
              accessibilityHint={type.hint}
              accessibilityState={{ checked: preferences.types[type.key] !== false }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  permissionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 10,
    gap: 8,
  },
  permissionTitle: { fontSize: 16, fontWeight: '700' },
  permissionBody: { fontSize: 14, lineHeight: 19 },
  permissionButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 13, lineHeight: 17 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
