
import { Stack } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import { MastodonNotification } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';
import { getNotifications, clearNotifications } from '@/lib/mastodon';

// Helper to resolve image sources
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const [notifications, setNotifications] = useState<MastodonNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('NotificationsScreen mounted, loading notifications');
    loadNotifications();
  }, []);

  const loadNotifications = useCallback(async (maxId?: string) => {
    try {
      console.log('Loading notifications', maxId ? `with maxId: ${maxId}` : '');
      if (!maxId) {
        setLoading(true);
      }
      const response = await getNotifications(maxId);
      console.log(`Loaded ${response.notifications.length} notifications`);

      if (maxId) {
        setNotifications((prev) => [...prev, ...response.notifications]);
      } else {
        setNotifications(response.notifications);
      }
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      setErrorMessage(error.message || 'Failed to load notifications');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleClearAll = async () => {
    setClearModalVisible(false);
    setLoading(true);

    try {
      console.log('Clearing all notifications');
      await clearNotifications();
      console.log('Notifications cleared successfully');
      setNotifications([]);
    } catch (error: any) {
      console.error('Failed to clear notifications:', error);
      setErrorMessage(error.message || 'Failed to clear notifications');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return { ios: 'at', android: 'alternate-email' };
      case 'reblog':
        return { ios: 'arrow.2.squarepath', android: 'repeat' };
      case 'favourite':
        return { ios: 'heart.fill', android: 'favorite' };
      case 'follow':
        return { ios: 'person.badge.plus', android: 'person-add' };
      case 'poll':
        return { ios: 'chart.bar', android: 'poll' };
      case 'status':
        return { ios: 'bell.fill', android: 'notifications' };
      default:
        return { ios: 'bell', android: 'notifications' };
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

  const getNotificationText = (notification: MastodonNotification) => {
    const displayName = notification.account.displayName || notification.account.username;
    switch (notification.type) {
      case 'mention':
        return `${displayName} mentioned you`;
      case 'reblog':
        return `${displayName} boosted your post`;
      case 'favourite':
        return `${displayName} liked your post`;
      case 'follow':
        return `${displayName} followed you`;
      case 'poll':
        return `A poll you voted in has ended`;
      case 'status':
        return `${displayName} posted`;
      default:
        return `${displayName} interacted with you`;
    }
  };

  const formatDate = (dateString: string) => {
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

  const renderNotification = ({ item }: { item: MastodonNotification }) => {
    const icon = getNotificationIcon(item.type);
    const color = getNotificationColor(item.type);
    const text = getNotificationText(item);
    const timeAgo = formatDate(item.createdAt);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${text}. ${timeAgo}`}
      >
        <View style={styles.notificationHeader}>
          <Image
            source={resolveImageSource(item.account.avatar)}
            style={styles.avatar}
            accessibilityLabel={`${item.account.displayName || item.account.username}'s avatar`}
          />
          <View style={styles.notificationContent}>
            <View style={styles.notificationTop}>
              <IconSymbol
                ios_icon_name={icon.ios}
                android_material_icon_name={icon.android}
                size={16}
                color={color}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.notificationText, { color: theme.text }]} numberOfLines={2}>
                {text}
              </Text>
            </View>
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {timeAgo}
            </Text>
            {item.status && (
              <Text style={[styles.statusPreview, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.status.content.replace(/<[^>]*>/g, '')}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerShown: false,
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
          headerShown: false,
        }}
      />

      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            onPress={() => setClearModalVisible(true)}
            style={styles.clearButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear all notifications"
          >
            <Text style={[styles.clearButtonText, { color: theme.primary }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
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
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : undefined}
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
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.error }]}
                onPress={handleClearAll}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
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
