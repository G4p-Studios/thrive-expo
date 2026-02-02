
import React, { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
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
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import ComposeModal from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import {
  getListTimeline,
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

export default function ListTimelineScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const listId = params.id as string;
  const listTitle = params.title as string || 'List';
  
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<string | undefined>(undefined);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>(undefined);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('ListTimelineScreen mounted for list:', listId, listTitle);
    loadTimeline();
  }, [listId]);

  const loadTimeline = useCallback(async (maxId?: string) => {
    try {
      console.log('Loading list timeline', maxId ? `with maxId: ${maxId}` : '');
      if (!maxId) {
        setLoading(true);
      }
      const response = await getListTimeline(listId, maxId);
      console.log(`Loaded ${response.posts.length} posts from list timeline`);

      if (maxId) {
        setPosts((prev) => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
    } catch (error: any) {
      console.error('Failed to load list timeline:', error);
      setErrorMessage(error.message || 'Failed to load timeline');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [listId]);

  const handleReply = (postId: string) => {
    console.log('User tapped reply on post:', postId);
    const post = posts.find(p => p.id === postId);
    if (post) {
      console.log('Opening reply composer for:', post.account.username);
      setReplyToPostId(postId);
      setReplyToUsername(post.account.username);
      setComposeVisible(true);
    }
  };

  const handleSubmitPost = async (content: string) => {
    try {
      console.log('Submitting reply:', content, 'to post:', replyToPostId);

      if (replyToPostId) {
        await createPost(content, { inReplyToId: replyToPostId });
        console.log('Reply submitted successfully');
      }

      setComposeVisible(false);
      setReplyToPostId(undefined);
      setReplyToUsername(undefined);
    } catch (error: any) {
      console.error('Failed to submit reply:', error);
      setErrorMessage(error.message || 'Failed to post');
      setErrorModalVisible(true);
    }
  };

  const handleReblog = async (postId: string, currentState: boolean) => {
    console.log(`User tapped ${currentState ? 'unreblog' : 'reblog'} on post:`, postId);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, reblogged: !currentState, reblogsCount: (p.reblogsCount || 0) + (currentState ? -1 : 1) }
          : p
      )
    );

    try {
      if (currentState) {
        await unreblog(postId);
      } else {
        await reblog(postId);
      }
      console.log('Reblog action completed');
    } catch (error: any) {
      console.error('Failed to reblog:', error);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, reblogged: currentState, reblogsCount: (p.reblogsCount || 0) + (currentState ? 1 : -1) }
            : p
        )
      );
      setErrorMessage(error.message || 'Failed to reblog');
      setErrorModalVisible(true);
    }
  };

  const handleFavourite = async (postId: string, currentState: boolean) => {
    console.log(`User tapped ${currentState ? 'unfavourite' : 'favourite'} on post:`, postId);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, favourited: !currentState, favouritesCount: (p.favouritesCount || 0) + (currentState ? -1 : 1) }
          : p
      )
    );

    try {
      if (currentState) {
        await unfavourite(postId);
      } else {
        await favourite(postId);
      }
      console.log('Favourite action completed');
    } catch (error: any) {
      console.error('Failed to favourite:', error);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, favourited: currentState, favouritesCount: (p.favouritesCount || 0) + (currentState ? 1 : -1) }
            : p
        )
      );
      setErrorMessage(error.message || 'Failed to favourite');
      setErrorModalVisible(true);
    }
  };

  const handleBookmark = async (postId: string, currentState: boolean) => {
    console.log(`User tapped ${currentState ? 'unbookmark' : 'bookmark'} on post:`, postId);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, bookmarked: !currentState }
          : p
      )
    );

    try {
      if (currentState) {
        await unbookmark(postId);
      } else {
        await bookmark(postId);
      }
      console.log('Bookmark action completed');
    } catch (error: any) {
      console.error('Failed to bookmark:', error);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, bookmarked: currentState }
            : p
        )
      );
      setErrorMessage(error.message || 'Failed to bookmark');
      setErrorModalVisible(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: listTitle,
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
          title: listTitle,
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReply={handleReply}
            onReblog={handleReblog}
            onFavourite={handleFavourite}
            onBookmark={handleBookmark}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log('User pulled to refresh');
              setRefreshing(true);
              loadTimeline();
            }}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={64}
              color={theme.textSecondary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No posts in this list yet. Add accounts to this list to see their posts here!
            </Text>
          </View>
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyListContent : undefined}
      />

      <ComposeModal
        visible={composeVisible}
        onClose={() => {
          setComposeVisible(false);
          setReplyToPostId(undefined);
          setReplyToUsername(undefined);
        }}
        onSubmit={handleSubmitPost}
        replyToId={replyToPostId}
        replyToUsername={replyToUsername}
      />

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
              accessibilityHint="Double tap to close"
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
