import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import ComposeModal, { ComposeSubmission } from '@/components/ComposeModal';
import ActionSheet from '@/components/ActionSheet';
import {
  getConversations,
  markConversationRead,
  deleteConversation,
  createPost,
  stripHtml,
  type PageCursor,
} from '@/lib/mastodon';
import type { MastodonAccount, MastodonConversation } from '@/types/mastodon';

/** "Alex", "Alex and Sam", "Alex and 3 others" */
function describeParticipants(accounts: MastodonAccount[]): string {
  const names = accounts.map(a => a.displayName || a.username);
  if (names.length === 0) return 'Just you';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

function formatTime(dateString: string, now: number): string {
  const date = new Date(dateString);
  const diffMins = Math.floor((now - date.getTime()) / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d`;
  return date.toLocaleDateString();
}

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [conversations, setConversations] = useState<MastodonConversation[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MastodonConversation | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  // Captured on load so relative times are not computed during render.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const loadConversations = useCallback(async () => {
    try {
      const response = await getConversations();
      setConversations(response.conversations);
      setCursor(response.next);
      setLoadedAt(Date.now());
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load your messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reloads on focus so a reply sent from the thread shows up here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!cancelled) await loadConversations();
      })();

      return () => {
        cancelled = true;
      };
    }, [loadConversations])
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await getConversations(cursor);
      setConversations(prev => [...prev, ...response.conversations]);
      setCursor(response.next);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const openConversation = useCallback(async (conversation: MastodonConversation) => {
    if (!conversation.lastStatus) return;

    // Clear the unread dot straight away; the thread is about to be on screen.
    if (conversation.unread) {
      setConversations(prev =>
        prev.map(c => (c.id === conversation.id ? { ...c, unread: false } : c))
      );
      markConversationRead(conversation.id).catch(error => {
        console.warn('[Messages] Could not mark conversation read:', error);
      });
    }

    router.push(`/post/${conversation.lastStatus.id}` as any);
  }, [router]);

  const handleDelete = useCallback(async (conversation: MastodonConversation) => {
    setConversations(prev => prev.filter(c => c.id !== conversation.id));
    try {
      await deleteConversation(conversation.id);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not delete that conversation');
      // Put it back — the server still has it.
      loadConversations();
    }
  }, [loadConversations]);

  const handleMarkRead = useCallback(async (conversation: MastodonConversation) => {
    setConversations(prev =>
      prev.map(c => (c.id === conversation.id ? { ...c, unread: false } : c))
    );
    try {
      await markConversationRead(conversation.id);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not mark that as read');
    }
  }, []);

  const handleSubmitPost = async (content: string, submission: ComposeSubmission) => {
    try {
      await createPost(content, submission);
      setComposeVisible(false);
      loadConversations();
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not send that message');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setComposeVisible(true)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="New message"
              accessibilityHint="Double tap to write a direct message"
            >
              <IconSymbol
                ios_icon_name="square.and.pencil"
                android_material_icon_name="edit"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const participants = describeParticipants(item.accounts);
            const preview = item.lastStatus
              ? stripHtml(item.lastStatus.content).replace(/\s+/g, ' ')
              : 'No messages yet';
            const time = item.lastStatus ? formatTime(item.lastStatus.createdAt, loadedAt) : '';
            const avatar = item.accounts[0]?.avatar;

            return (
              <View style={[styles.row, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => openConversation(item)}
                  disabled={!item.lastStatus}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.unread ? 'Unread. ' : ''}${participants}. ${preview}${
                    time ? `. ${time}` : ''
                  }`}
                  accessibilityHint={
                    item.lastStatus
                      ? 'Double tap to open this conversation'
                      : 'This conversation has no messages left'
                  }
                >
                  <View style={styles.avatarWrap} accessible={false}>
                    {avatar ? (
                      <Image
                        source={{ uri: avatar }}
                        style={[styles.avatar, { backgroundColor: theme.card }]}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: theme.card }]} />
                    )}
                    {item.unread && (
                      <View
                        style={[styles.unreadDot, { backgroundColor: theme.primary, borderColor: theme.background }]}
                        accessible={false}
                      />
                    )}
                  </View>

                  <View style={styles.rowText} accessible={false}>
                    <View style={styles.titleLine} accessible={false}>
                      <Text
                        style={[
                          styles.participants,
                          { color: theme.text, fontWeight: item.unread ? '700' : '600' },
                        ]}
                        numberOfLines={1}
                        accessible={false}
                      >
                        {participants}
                      </Text>
                      {time ? (
                        <Text
                          style={[styles.time, { color: theme.textSecondary }]}
                          accessible={false}
                        >
                          {time}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.preview, { color: theme.textSecondary }]}
                      numberOfLines={2}
                      accessible={false}
                    >
                      {preview}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setMenuTarget(item)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for the conversation with ${participants}`}
                  accessibilityHint="Double tap for options including deleting this conversation"
                >
                  <IconSymbol
                    ios_icon_name="ellipsis"
                    android_material_icon_name="more-horiz"
                    size={20}
                    color={theme.textSecondary}
                    accessible={false}
                  />
                </TouchableOpacity>
              </View>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
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
              <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
                No messages
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Direct messages are posts only the people you mention can see. Use the button above
                to start one.
              </Text>
            </View>
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyContent : undefined}
        />
      )}

      <ActionSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        title={menuTarget ? describeParticipants(menuTarget.accounts) : undefined}
        items={
          menuTarget
            ? [
                ...(menuTarget.unread
                  ? [
                      {
                        key: 'read',
                        label: 'Mark as read',
                        ios: 'envelope.open',
                        android: 'drafts',
                        onPress: () => handleMarkRead(menuTarget),
                      },
                    ]
                  : []),
                {
                  key: 'delete',
                  label: 'Delete conversation',
                  hint: 'Removes it from your list. The messages themselves are not deleted.',
                  ios: 'trash',
                  android: 'delete',
                  destructive: true,
                  onPress: () => handleDelete(menuTarget),
                },
              ]
            : []
        }
      />

      <ComposeModal
        visible={composeVisible}
        onClose={() => setComposeVisible(false)}
        onSubmit={handleSubmitPost}
        initialVisibility="direct"
      />

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingVertical: 12,
  },
  avatarWrap: { width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  rowText: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  participants: { flex: 1, fontSize: 15 },
  time: { fontSize: 12 },
  preview: { fontSize: 14, lineHeight: 18 },
  menuButton: { padding: 10 },
  footer: { paddingVertical: 20, alignItems: 'center' },
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
