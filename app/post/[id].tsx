
import React, { useState, useEffect, useCallback } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { colors } from '@/styles/commonStyles';
import ComposeModal, { ComposeSubmission } from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import {
  getReplyTarget,
  getAccountCache,
  editPost,
  getPost,
  getPostContext,
  createPost,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
} from '@/lib/mastodon';
import { MastodonPost } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';

interface ThreadItem {
  post: MastodonPost;
  isMain: boolean;
}

export default function PostDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [threadItems, setThreadItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [replyToPost, setReplyToPost] = useState<MastodonPost | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<MastodonPost | undefined>(undefined);
  const [currentAccountId, setCurrentAccountId] = useState<string | undefined>(undefined);
  const [reportTarget, setReportTarget] = useState<MastodonPost | undefined>(undefined);
  const [menuTargetId, setMenuTargetId] = useState<string | undefined>(undefined);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  // Needed to decide whether the main post is ours and therefore editable.
  useEffect(() => {
    getAccountCache()
      .then(account => setCurrentAccountId(account?.id))
      .catch(() => {
        // Without it we simply don't offer editing.
      });
  }, []);

  const loadThread = useCallback(async () => {
    if (!id) return;
    try {
      const [post, context] = await Promise.all([
        getPost(id),
        getPostContext(id),
      ]);

      const items: ThreadItem[] = [
        ...context.ancestors.map(p => ({ post: p, isMain: false })),
        { post, isMain: true },
        ...context.descendants.map(p => ({ post: p, isMain: false })),
      ];
      setThreadItems(items);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load post');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const updatePost = useCallback((postId: string, updater: (p: MastodonPost) => MastodonPost) => {
    setThreadItems(prev =>
      prev.map(item =>
        item.post.id === postId ? { ...item, post: updater(item.post) } : item
      )
    );
  }, []);

  const handleReply = useCallback((postId: string) => {
    const item = threadItems.find(i => i.post.id === postId);
    if (item) {
      setEditingPost(undefined);
      setReplyToPost(item.post);
      setComposeVisible(true);
    }
  }, [threadItems]);

  const handleEdit = useCallback((postId: string) => {
    const item = threadItems.find(i => i.post.id === postId);
    if (item) {
      setReplyToPost(undefined);
      setEditingPost(item.post);
      setComposeVisible(true);
    }
  }, [threadItems]);

  const handleReport = useCallback((postId: string) => {
    const item = threadItems.find(i => i.post.id === postId);
    if (item) {
      // Boosts are reported against the original post and its author.
      setReportTarget(getReplyTarget(item.post));
    }
  }, [threadItems]);

  const handleSubmitPost = async (content: string, submission: ComposeSubmission) => {
    try {
      if (editingPost) {
        await editPost(editingPost.id, content, {
          mediaIds: submission.mediaIds,
          sensitive: submission.sensitive,
          spoilerText: submission.spoilerText,
        });
      } else {
        await createPost(content, {
          inReplyToId: replyToPost ? getReplyTarget(replyToPost).id : undefined,
          ...submission,
        });
      }
      setComposeVisible(false);
      setReplyToPost(undefined);
      setEditingPost(undefined);
      loadThread();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to post');
      setErrorModalVisible(true);
    }
  };

  const handleReblog = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({
      ...p,
      reblogged: !currentState,
      reblogsCount: (p.reblogsCount || 0) + (currentState ? -1 : 1),
    }));
    try {
      if (currentState) {
        await unreblog(postId);
      } else {
        await reblog(postId);
      }
    } catch (error: any) {
      updatePost(postId, p => ({
        ...p,
        reblogged: currentState,
        reblogsCount: (p.reblogsCount || 0) + (currentState ? 1 : -1),
      }));
      setErrorMessage(error.message || 'Failed to reblog');
      setErrorModalVisible(true);
    }
  }, [updatePost]);

  const handleFavourite = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({
      ...p,
      favourited: !currentState,
      favouritesCount: (p.favouritesCount || 0) + (currentState ? -1 : 1),
    }));
    try {
      if (currentState) {
        await unfavourite(postId);
      } else {
        await favourite(postId);
      }
    } catch (error: any) {
      updatePost(postId, p => ({
        ...p,
        favourited: currentState,
        favouritesCount: (p.favouritesCount || 0) + (currentState ? 1 : -1),
      }));
      setErrorMessage(error.message || 'Failed to favourite');
      setErrorModalVisible(true);
    }
  }, [updatePost]);

  const handleBookmark = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({ ...p, bookmarked: !currentState }));
    try {
      if (currentState) {
        await unbookmark(postId);
      } else {
        await bookmark(postId);
      }
    } catch (error: any) {
      updatePost(postId, p => ({ ...p, bookmarked: currentState }));
      setErrorMessage(error.message || 'Failed to bookmark');
      setErrorModalVisible(true);
    }
  }, [updatePost]);

  const handlePostPress = useCallback((postId: string) => {
    if (postId !== id) {
      router.push(`/post/${postId}` as any);
    }
  }, [id, router]);

  const renderItem = useCallback(({ item }: { item: ThreadItem }) => {
    // Only our own posts can be edited, and boosts are edited at the source.
    const canEdit =
      !!currentAccountId && !item.post.reblog && item.post.account.id === currentAccountId;

    return (
      <View style={item.isMain ? [styles.mainPost, { borderLeftColor: theme.primary }] : undefined}>
        <PostCard
          post={item.post}
          onReply={handleReply}
          onReblog={handleReblog}
          onFavourite={handleFavourite}
          onBookmark={handleBookmark}
          onPress={handlePostPress}
        />
        {/* Secondary actions sit behind a menu so Report isn't a stray tap
            away from reply and boost. */}
        {currentAccountId && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[styles.smallButton, { borderColor: theme.border }]}
              onPress={() => setMenuTargetId(item.post.id)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="More actions"
              accessibilityHint={
                canEdit
                  ? 'Double tap for options including editing this post'
                  : 'Double tap for options including reporting this post'
              }
            >
              <IconSymbol
                ios_icon_name="ellipsis"
                android_material_icon_name="more-horiz"
                size={16}
                color={theme.textSecondary}
                accessible={false}
              />
              <Text style={[styles.smallButtonText, { color: theme.textSecondary }]}>More</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [handleReply, handleReblog, handleFavourite, handleBookmark, handlePostPress, currentAccountId, theme.primary, theme.border, theme.textSecondary]);

  const menuPost = threadItems.find(i => i.post.id === menuTargetId)?.post;
  const menuIsOwn =
    !!menuPost && !!currentAccountId && !menuPost.reblog && menuPost.account.id === currentAccountId;

  const menuItems = menuPost
    ? menuIsOwn
      ? [
          {
            key: 'edit',
            label: 'Edit post',
            hint: 'Change the text or content warning',
            ios: 'pencil',
            android: 'edit',
            onPress: () => handleEdit(menuPost.id),
          },
        ]
      : [
          {
            key: 'report',
            label: 'Report post',
            hint: 'Send this post to the moderators for review',
            ios: 'flag',
            android: 'flag',
            destructive: true,
            onPress: () => handleReport(menuPost.id),
          },
        ]
    : [];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Post',
            headerShown: true,
            headerBackTitle: 'Back',
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
          title: 'Post',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <FlatList
        data={threadItems}
        keyExtractor={(item) => item.post.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadThread();
            }}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              Post not found.
            </Text>
          </View>
        }
        contentContainerStyle={threadItems.length === 0 ? styles.emptyListContent : undefined}
      />

      <ComposeModal
        visible={composeVisible}
        onClose={() => {
          setComposeVisible(false);
          setReplyToPost(undefined);
          setEditingPost(undefined);
        }}
        onSubmit={handleSubmitPost}
        replyToPost={replyToPost}
        editingPost={editingPost}
      />

      <ActionSheet
        visible={!!menuTargetId}
        onClose={() => setMenuTargetId(undefined)}
        title={menuIsOwn ? 'Your post' : `Post by @${menuPost?.account.acct ?? ''}`}
        items={menuItems}
      />

      {reportTarget && (
        <ReportModal
          visible={!!reportTarget}
          onClose={() => setReportTarget(undefined)}
          account={reportTarget.account}
          post={reportTarget}
        />
      )}

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
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="OK"
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
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mainPost: {
    borderLeftWidth: 3,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 16,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginLeft: 16,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
