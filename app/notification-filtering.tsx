import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getNotificationPolicy,
  updateNotificationPolicy,
  MastodonAPIError,
  type NotificationPolicy,
  type NotificationPolicyAction,
  type NotificationPolicyUpdate,
} from '@/lib/mastodon';

type CategoryKey = keyof NotificationPolicyUpdate;

const CATEGORIES: { key: CategoryKey; label: string; hint: string }[] = [
  {
    key: 'forNotFollowing',
    label: "People you don't follow",
    hint: 'Anyone whose posts you have not chosen to see',
  },
  {
    key: 'forNotFollowers',
    label: "People who don't follow you",
    hint: 'They can still see your public posts',
  },
  {
    key: 'forNewAccounts',
    label: 'Brand new accounts',
    hint: 'Accounts created in the last 30 days, which is the usual shape of a spam wave',
  },
  {
    key: 'forPrivateMentions',
    label: 'Unsolicited private mentions',
    hint: 'Private mentions from people you do not follow, and who are not replying to you',
  },
  {
    key: 'forLimitedAccounts',
    label: 'Accounts your server has limited',
    hint: 'Accounts your moderators have restricted but not suspended',
  },
];

const ACTIONS: { value: NotificationPolicyAction; label: string; hint: string }[] = [
  { value: 'accept', label: 'Allow', hint: 'Notify you as normal' },
  { value: 'filter', label: 'Review', hint: 'Hold it for you to look at first' },
  { value: 'drop', label: 'Ignore', hint: 'Discard it without telling you' },
];

export default function NotificationFilteringScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [policy, setPolicy] = useState<NotificationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await getNotificationPolicy();
        if (!cancelled) setPolicy(loaded);
      } catch (error: any) {
        if (cancelled) return;
        // Filtering arrived in Mastodon 4.3. On anything older this is not a
        // failure — the server simply cannot do it, and saying so beats an
        // error somebody can do nothing about.
        if (error instanceof MastodonAPIError && error.status === 404) {
          setUnsupported(true);
        } else {
          setErrorMessage(error.message || 'Could not load your filtering rules');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(
    async (key: CategoryKey, value: NotificationPolicyAction, label: string) => {
      if (!policy || policy[key] === value) return;

      const previous = policy;
      // Move the selection now; a control that lags behind the tap reads as
      // not having worked.
      setPolicy({ ...policy, [key]: value });

      try {
        const saved = await updateNotificationPolicy({ [key]: value });
        setPolicy(saved);
        AccessibilityInfo.announceForAccessibility(
          `${label}: ${ACTIONS.find(a => a.value === value)?.label}`
        );
      } catch (error: any) {
        setPolicy(previous);
        setErrorMessage(error.message || 'Could not save that change');
      }
    },
    [policy]
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  if (unsupported || !policy) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View style={styles.center}>
          <IconSymbol
            ios_icon_name="line.3.horizontal.decrease.circle"
            android_material_icon_name="filter-list"
            size={56}
            color={theme.textSecondary}
            style={{ marginBottom: 16 }}
            accessible={false}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
            Your server can't filter notifications
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            This needs Mastodon 4.3 or newer. Everything else in Thrive works as usual — only these
            rules are unavailable.
          </Text>
        </View>
      </View>
    );
  }

  const pending = policy.pendingRequestsCount;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={SCREEN_OPTIONS} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <IconSymbol
            ios_icon_name="info.circle"
            android_material_icon_name="info"
            size={20}
            color={theme.textSecondary}
            accessible={false}
          />
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
            These rules decide what reaches you before it becomes a notification. Anything set to
            Review waits in your filtered list instead. Nothing here blocks or mutes anybody, and
            nobody is told what you choose.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.inboxRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push('/notification-requests' as any)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={
            pending > 0
              ? `Filtered notifications, ${pending} ${pending === 1 ? 'person' : 'people'} waiting`
              : 'Filtered notifications, nobody waiting'
          }
          accessibilityHint="Opens the list of people held for review"
        >
          <IconSymbol
            ios_icon_name="tray"
            android_material_icon_name="inbox"
            size={24}
            color={theme.primary}
            style={{ marginRight: 14 }}
            accessible={false}
          />
          <View style={styles.inboxText} accessible={false}>
            <Text style={[styles.inboxTitle, { color: theme.text }]} accessible={false}>
              Filtered notifications
            </Text>
            <Text style={[styles.inboxHint, { color: theme.textSecondary }]} accessible={false}>
              {pending > 0
                ? `${pending} ${pending === 1 ? 'person is' : 'people are'} waiting for your decision`
                : 'Nobody is waiting'}
            </Text>
          </View>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="arrow-forward"
            size={20}
            color={theme.textSecondary}
            accessible={false}
          />
        </TouchableOpacity>

        <Text
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
          accessibilityRole="header"
        >
          NOTIFICATIONS FROM
        </Text>

        {CATEGORIES.map(category => {
          const current = policy[category.key];

          return (
            <View
              key={category.key}
              style={[styles.category, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.categoryLabel, { color: theme.text }]}>{category.label}</Text>
              <Text style={[styles.categoryHint, { color: theme.textSecondary }]}>
                {category.hint}
              </Text>

              <View
                style={[styles.segmented, { borderColor: theme.border }]}
                accessibilityRole="radiogroup"
                accessibilityLabel={category.label}
              >
                {ACTIONS.map(action => {
                  const selected = current === action.value;

                  return (
                    <TouchableOpacity
                      key={action.value}
                      style={[
                        styles.segment,
                        selected && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => choose(category.key, action.value, category.label)}
                      accessible={true}
                      accessibilityRole="radio"
                      accessibilityLabel={action.label}
                      accessibilityHint={action.hint}
                      accessibilityState={{ selected, checked: selected }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: selected ? '#FFFFFF' : theme.text },
                        ]}
                        accessible={false}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!errorMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorMessage('')}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              Something went wrong
            </Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => setErrorMessage('')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const SCREEN_OPTIONS = {
  title: 'Filtering',
  headerShown: true,
  headerBackTitle: 'Back',
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
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
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  inboxText: { flex: 1, gap: 2 },
  inboxTitle: { fontSize: 15, fontWeight: '600' },
  inboxHint: { fontSize: 13, lineHeight: 17 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  category: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  categoryLabel: { fontSize: 15, fontWeight: '600' },
  categoryHint: { fontSize: 13, lineHeight: 17 },
  segmented: {
    flexDirection: 'row',
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 15, lineHeight: 20 },
  modalButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
