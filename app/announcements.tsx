import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import {
  getAnnouncements,
  dismissAnnouncement,
  type MastodonAnnouncement,
} from '@/lib/mastodon';

export default function AnnouncementsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [announcements, setAnnouncements] = useState<MastodonAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getAnnouncements();
        if (!cancelled) setAnnouncements(result);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load announcements');
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

  const handleDismiss = useCallback(async (announcement: MastodonAnnouncement) => {
    setPendingId(announcement.id);
    setAnnouncements(prev =>
      prev.map(a => (a.id === announcement.id ? { ...a, read: true } : a))
    );
    try {
      await dismissAnnouncement(announcement.id);
    } catch (error: any) {
      setAnnouncements(prev =>
        prev.map(a => (a.id === announcement.id ? { ...a, read: false } : a))
      );
      setErrorMessage(error.message || 'Could not mark that as read');
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Server announcements', headerShown: true, headerBackTitle: 'Back' }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={item => item.id}
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
          renderItem={({ item }) => (
            <View
              style={[styles.row, { borderBottomColor: theme.border }]}
              accessible={true}
              accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.content}`}
            >
              <View style={styles.rowHeader} accessible={false}>
                {!item.read && (
                  <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} accessible={false} />
                )}
                {item.publishedAt ? (
                  <Text style={[styles.date, { color: theme.textSecondary }]} accessible={false}>
                    {new Date(item.publishedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.content, { color: theme.text }]} accessible={false}>
                {item.content}
              </Text>
              {!item.read && (
                <TouchableOpacity
                  style={[styles.dismissButton, { borderColor: theme.border }]}
                  onPress={() => handleDismiss(item)}
                  disabled={pendingId === item.id}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as read"
                  accessibilityState={{ disabled: pendingId === item.id }}
                >
                  {pendingId === item.id ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <Text style={[styles.dismissText, { color: theme.text }]}>Mark as read</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
                No announcements
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                When the people running your server post news, it appears here.
              </Text>
            </View>
          }
          contentContainerStyle={announcements.length === 0 ? styles.emptyContent : undefined}
        />
      )}

      <Modal
        visible={!!errorMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorMessage('')}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, gap: 8 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  date: { fontSize: 12 },
  content: { fontSize: 15, lineHeight: 21 },
  dismissButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  dismissText: { fontSize: 13, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 19, textAlign: 'center' },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 15, lineHeight: 20 },
  modalButton: { marginTop: 6, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  modalButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
