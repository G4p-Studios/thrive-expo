import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getNotificationRequests,
  acceptNotificationRequest,
  dismissNotificationRequest,
  areNotificationRequestsMerged,
  stripHtml,
  joinSpokenParts,
  type NotificationRequest,
  type PageCursor,
} from '@/lib/mastodon';

/** How long to keep asking whether accepted notifications have merged. */
const MERGE_POLL_INTERVAL_MS = 2000;
const MERGE_POLL_TIMEOUT_MS = 20000;

function nameOf(request: NotificationRequest): string {
  return request.account.displayName?.trim() || request.account.username;
}

/**
 * What one waiting sender's row should say.
 *
 * The count matters more than it looks: one held notification is somebody who
 * tried once, twenty is somebody persisting, and that difference is most of
 * what the decision rests on.
 */
function describeRequest(request: NotificationRequest): string {
  const count = request.notificationsCount;
  const held = count === 1 ? '1 notification' : `${count} notifications`;
  const parts = [`${nameOf(request)}, @${request.account.acct}`, `${held} waiting`];

  if (request.lastStatus) {
    const spoiler = request.lastStatus.spoilerText?.trim();
    if (spoiler) {
      // Filtering somebody's notification does not entitle us to read past
      // the warning they set.
      parts.push(`Content warning: ${spoiler}`);
    } else {
      const preview = stripHtml(request.lastStatus.content ?? '').trim();
      if (preview) parts.push(`Most recent: ${preview}`);
    }
  }

  return joinSpokenParts(parts);
}

export default function NotificationRequestsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [requests, setRequests] = useState<NotificationRequest[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Guards the merge poll, which outlives the call that started it.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getNotificationRequests();
        if (cancelled) return;
        setRequests(response.requests);
        setCursor(response.next);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load filtered notifications');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await getNotificationRequests(cursor);
      setRequests(prev => [...prev, ...response.requests]);
      setCursor(response.next);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  /**
   * Wait for the server to fold accepted notifications into the main list.
   *
   * Accepting queues background work. Saying "done" before it finishes sends
   * somebody to a notification list that is missing what they just accepted,
   * which reads as the accept having failed.
   */
  const waitForMerge = useCallback(async () => {
    setMerging(true);
    const deadline = Date.now() + MERGE_POLL_TIMEOUT_MS;

    while (aliveRef.current && Date.now() < deadline) {
      try {
        if (await areNotificationRequestsMerged()) break;
      } catch {
        // A server that cannot answer is not worth blocking the screen over.
        break;
      }
      await new Promise(resolve => setTimeout(resolve, MERGE_POLL_INTERVAL_MS));
    }

    if (!aliveRef.current) return;
    setMerging(false);
    AccessibilityInfo.announceForAccessibility('Their notifications have been added');
  }, []);

  const respond = useCallback(
    async (request: NotificationRequest, accept: boolean) => {
      setPendingId(request.id);
      try {
        if (accept) {
          await acceptNotificationRequest(request.id);
        } else {
          await dismissNotificationRequest(request.id);
        }

        setRequests(prev => prev.filter(r => r.id !== request.id));
        AccessibilityInfo.announceForAccessibility(
          accept
            ? `Allowed @${request.account.acct}. Adding their notifications.`
            : `Dismissed @${request.account.acct}`
        );

        if (accept) waitForMerge();
      } catch (error: any) {
        setErrorMessage(
          error.message ||
            `Could not ${accept ? 'allow' : 'dismiss'} @${request.account.acct}`
        );
      } finally {
        setPendingId(null);
      }
    },
    [waitForMerge]
  );

  const renderRequest = ({ item }: { item: NotificationRequest }) => {
    const busy = pendingId === item.id;
    const name = nameOf(item);
    const count = item.notificationsCount;

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => router.push(`/account/${item.account.id}` as any)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={describeRequest(item)}
          accessibilityHint="Opens their profile"
          accessibilityActions={REQUEST_ACTIONS}
          onAccessibilityAction={event => {
            if (busy) return;
            const action = event.nativeEvent.actionName;
            if (action === 'allow') respond(item, true);
            if (action === 'dismiss') respond(item, false);
          }}
        >
          <Image
            source={{ uri: item.account.avatar }}
            style={styles.avatar}
            accessible={false}
          />
          <View style={styles.cardText} accessible={false}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1} accessible={false}>
              {name}
            </Text>
            <Text
              style={[styles.handle, { color: theme.textSecondary }]}
              numberOfLines={1}
              accessible={false}
            >
              @{item.account.acct}
            </Text>
            <Text style={[styles.count, { color: theme.primary }]} accessible={false}>
              {count === 1 ? '1 notification waiting' : `${count} notifications waiting`}
            </Text>
            {item.lastStatus ? (
              <Text
                style={[styles.preview, { color: theme.textSecondary }]}
                numberOfLines={2}
                accessible={false}
              >
                {item.lastStatus.spoilerText?.trim()
                  ? `Content warning: ${item.lastStatus.spoilerText.trim()}`
                  : stripHtml(item.lastStatus.content ?? '')}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Hidden from the accessibility tree: the card above is a single
            element, and these are reached through its custom actions. */}
        <View
          style={styles.actions}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: theme.border }]}
                onPress={() => respond(item, false)}
                accessible={false}
              >
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => respond(item, true)}
                accessible={false}
              >
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Allow</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Filtered notifications', headerShown: true, headerBackTitle: 'Back' }}
      />

      {merging ? (
        <View
          style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessible={true}
          accessibilityRole="progressbar"
          accessibilityLabel="Adding their notifications to your list"
        >
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>
            Adding their notifications to your list…
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          contentContainerStyle={requests.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setReloadToken(t => t + 1);
              }}
              tintColor={theme.text}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconSymbol
                ios_icon_name="tray"
                android_material_icon_name="inbox"
                size={56}
                color={theme.textSecondary}
                style={{ marginBottom: 16 }}
                accessible={false}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
                Nothing waiting
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                When your filtering rules hold a notification back, the person who sent it waits
                here until you allow or dismiss them.
              </Text>
            </View>
          }
        />
      )}

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

/**
 * Allow and Dismiss as custom actions.
 *
 * The card is a single accessibility element, so the buttons drawn inside it
 * are not reachable on their own — this is how VoiceOver gets at them.
 */
const REQUEST_ACTIONS = [
  { name: 'allow', label: 'Allow' },
  { name: 'dismiss', label: 'Dismiss' },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 12 },
  emptyContent: { flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  cardMain: { flexDirection: 'row', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  handle: { fontSize: 13 },
  count: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  preview: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionText: { fontSize: 14, fontWeight: '600' },
  footer: { paddingVertical: 20, alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
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
