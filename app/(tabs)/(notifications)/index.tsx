
import { Stack, router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getNotificationGroups,
  dismissNotificationGroup,
  clearNotifications,
  describeNotificationGroup,
  buildNotificationGroupLabel,
  stripHtml,
  type NotificationGroup,
  type PageCursor,
} from '@/lib/mastodon';

// Helper to resolve image sources
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

/**
 * Dismissing is the only per-row action, and the card is a single
 * accessibility element, so it is offered as a custom action rather than as a
 * button VoiceOver would have to be swiped into.
 */
const DISMISS_ACTION = [{ name: 'dismiss', label: 'Dismiss' }];

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  const loadNotifications = useCallback(async (next?: PageCursor | null) => {
    try {
      console.log('Loading notifications', next ? 'with cursor' : '');
      if (next) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await getNotificationGroups(next ?? null);
      console.log(
        `Loaded ${response.groups.length} notification groups`,
        response.grouped ? '(grouped)' : '(server cannot group)'
      );

      // The Link header is the authority on whether there is more: an empty
      // page can still be followed by a full one once filtered notifications
      // are skipped server-side.
      setCursor(response.next);

      if (next) {
        setGroups((prev) => [...prev, ...response.groups]);
      } else {
        setGroups(response.groups);
      }
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      setErrorMessage(error.message || 'Failed to load notifications');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    console.log('NotificationsScreen mounted, loading notifications');
    loadNotifications();
  }, [loadNotifications]);

  const handleClearAll = async () => {
    setClearModalVisible(false);
    setLoading(true);

    try {
      console.log('Clearing all notifications');
      await clearNotifications();
      console.log('Notifications cleared successfully');
      setGroups([]);
      setCursor(null);
    } catch (error: any) {
      console.error('Failed to clear notifications:', error);
      setErrorMessage(error.message || 'Failed to clear notifications');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove the row straight away, then tell the server.
   *
   * Waiting for the round trip would leave a row that has visibly been
   * dismissed still sitting there. If the call fails it goes back, so the list
   * never quietly disagrees with the server.
   */
  const handleDismiss = useCallback(async (group: NotificationGroup) => {
    let removedFrom = -1;

    setGroups((prev) => {
      removedFrom = prev.findIndex((g) => g.groupKey === group.groupKey);
      return prev.filter((g) => g.groupKey !== group.groupKey);
    });

    try {
      await dismissNotificationGroup(group.groupKey);
    } catch (error: any) {
      console.error('Failed to dismiss notification:', error);
      // Put it back where it was, not at the end — a notification that
      // reappears somewhere else reads as a new one.
      setGroups((prev) => {
        if (prev.some((g) => g.groupKey === group.groupKey)) return prev;
        const restored = [...prev];
        restored.splice(removedFrom < 0 ? restored.length : removedFrom, 0, group);
        return restored;
      });
      setErrorMessage(error.message || 'Could not dismiss that notification');
      setErrorModalVisible(true);
    }
  }, []);

  /**
   * Open what the notification is about: the post where there is one, the
   * person otherwise.
   */
  const handleOpen = useCallback((group: NotificationGroup) => {
    if (group.status) {
      router.push(`/post/${group.status.id}`);
    } else if (group.accounts.length > 0) {
      // Cast matches the rest of the app: the generated route types don't
      // cover this dynamic segment.
      router.push(`/account/${group.accounts[0].id}` as any);
    }
  }, []);

  // `as const` keeps the Material icon names as literals so they satisfy
  // IconSymbol's glyph-name union instead of widening to `string`.
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return { ios: 'at', android: 'alternate-email' } as const;
      case 'reblog':
        return { ios: 'arrow.2.squarepath', android: 'repeat' } as const;
      case 'favourite':
        return { ios: 'heart.fill', android: 'favorite' } as const;
      case 'follow':
        return { ios: 'person.badge.plus', android: 'person-add' } as const;
      case 'poll':
        return { ios: 'chart.bar', android: 'poll' } as const;
      case 'status':
        return { ios: 'bell.fill', android: 'notifications' } as const;
      default:
        return { ios: 'bell', android: 'notifications' } as const;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'mention':
        return theme.primary;
      case 'reblog':
        return theme.success;
      case 'favourite':
        return theme.error;
      case 'follow':
        return theme.accent;
      default:
        return theme.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: NotificationGroup }) => {
    const icon = getNotificationIcon(item.type);
    const color = getNotificationColor(item.type);
    const summary = describeNotificationGroup(item);
    const timeAgo = formatDate(item.createdAt);

    // Faces carry the "who" faster than the sentence does, but past three they
    // stop being recognisable and start being clutter.
    const avatars = item.accounts.slice(0, 3);

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.notificationCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => handleOpen(item)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={buildNotificationGroupLabel(item, timeAgo)}
          accessibilityHint={item.status ? 'Opens the post' : 'Opens the profile'}
          accessibilityActions={DISMISS_ACTION}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'dismiss') handleDismiss(item);
          }}
        >
          <View style={styles.notificationHeader}>
            <View
              style={styles.avatars}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {avatars.map((account, index) => (
                <Image
                  key={account.id}
                  source={resolveImageSource(account.avatar)}
                  style={[
                    styles.avatar,
                    index > 0 && styles.avatarStacked,
                    { borderColor: theme.card },
                  ]}
                  accessible={false}
                />
              ))}
            </View>
            <View style={styles.notificationContent} accessible={false}>
              <View style={styles.notificationTop} accessible={false}>
                <IconSymbol
                  ios_icon_name={icon.ios}
                  android_material_icon_name={icon.android}
                  size={16}
                  color={color}
                  style={{ marginRight: 8 }}
                  accessible={false}
                />
                <Text
                  style={[styles.notificationText, { color: theme.text }]}
                  numberOfLines={2}
                  accessible={false}
                >
                  {summary}
                </Text>
              </View>
              <Text
                style={[styles.timestamp, { color: theme.textSecondary }]}
                accessible={false}
              >
                {timeAgo}
              </Text>
              {item.status && (
                <Text
                  style={[styles.statusPreview, { color: theme.textSecondary }]}
                  numberOfLines={2}
                  accessible={false}
                >
                  {stripHtml(item.status.content ?? '')}
                </Text>
              )}
            </View>

            {/* The card is one accessibility element, so this is hidden from
                the tree and reached through the Dismiss action instead —
                exposing it as well would read the row twice. */}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleDismiss(item)}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              hitSlop={8}
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={16}
                color={theme.textSecondary}
                accessible={false}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const headerRight = useCallback(() => {
    if (groups.length === 0) return null;
    return (
      <TouchableOpacity
        onPress={() => setClearModalVisible(true)}
        style={styles.headerButton}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Clear all notifications"
      >
        <Text style={[styles.clearButtonText, { color: theme.primary }]}>Clear All</Text>
      </TouchableOpacity>
    );
  }, [groups.length, theme.primary]);

  const handleLoadMore = useCallback(() => {
    // No cursor means the server said this is the end of the collection.
    if (loadingMore || loading || !cursor) return;
    loadNotifications(cursor);
  }, [loadingMore, loading, cursor, loadNotifications]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.text} />
      </View>
    );
  }, [loadingMore, theme.text]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerShown: true,
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerRight,
        }}
      />

      <FlatList
        data={groups}
        keyExtractor={(item) => item.groupKey}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log('User pulled to refresh');
              setRefreshing(true);
              loadNotifications();
            }}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="bell"
              android_material_icon_name="notifications-none"
              size={64}
              color={theme.textSecondary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No notifications yet. When someone interacts with you, you'll see it here!
            </Text>
          </View>
        }
        contentContainerStyle={groups.length === 0 ? styles.emptyListContent : undefined}
        ListFooterComponent={footerComponent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Clear All Confirmation Modal */}
      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={48}
              color={theme.warning}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Clear All Notifications?
            </Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              This will clear all your notifications. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => setClearModalVisible(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.error }]}
                onPress={handleClearAll}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Clear all notifications"
              >
                <Text style={styles.modalButtonTextConfirm}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color={theme.error}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="OK"
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatars: {
    flexDirection: 'row',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  // Overlapped rather than in a row, so three faces cost barely more width
  // than one and the text keeps its space.
  avatarStacked: {
    marginLeft: -18,
    borderWidth: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusPreview: {
    fontSize: 14,
    marginTop: 4,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirm: {
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
