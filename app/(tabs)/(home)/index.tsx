
import { Stack, useRouter } from 'expo-router';
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
import ComposeModal from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MastodonPost } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';
import {
  isAuthenticated,
  getHomeTimeline,
  createPost,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
} from '@/lib/mastodon';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<string | undefined>(undefined);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;
  const bgColor = isDark ? colors.dark.background : colors.light.background;
  const textColor = isDark ? colors.dark.text : colors.light.text;

  const checkConnection = useCallback(async () => {
    try {
      console.log('Checking Mastodon connection status');
      const connected = await isAuthenticated();

      if (connected) {
        setIsConnected(true);
        loadTimeline();
      } else {
        console.log('No Mastodon account connected, redirecting to connect screen');
        setIsConnected(false);
        setLoading(false);
        router.replace('/connect-mastodon');
      }
    } catch (error: any) {
      console.log('Error checking Mastodon connection:', error);
      setIsConnected(false);
      setLoading(false);
      router.replace('/connect-mastodon');
    }
  }, [router]);

  useEffect(() => {
    console.log('HomeScreen mounted, checking Mastodon connection');
    checkConnection();
  }, [checkConnection]);

  const loadTimeline = useCallback(async (maxId?: string) => {
    try {
      if (!maxId) {
        setLoading(true);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      const response = await getHomeTimeline(maxId);

      if (response.posts.length === 0) {
        setHasMore(false);
      }

      if (maxId) {
        setPosts((prev) => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
    } catch (error: any) {
      console.error('Failed to load timeline:', error);
      setErrorMessage(error.message || 'Failed to load timeline');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const handleCompose = () => {
    console.log('User tapped compose button');
    setReplyToPostId(undefined);
    setReplyToUsername(undefined);
    setComposeVisible(true);
  };

  const handleSubmitPost = async (content: string, mediaIds?: string[]) => {
    try {
      console.log('Submitting post:', content, replyToPostId ? `as reply to ${replyToPostId}` : '');

      await createPost(content, {
        inReplyToId: replyToPostId,
        mediaIds,
      });
      console.log('Post submitted successfully');

      setComposeVisible(false);
      setReplyToPostId(undefined);
      setReplyToUsername(undefined);

      // Refresh timeline
      loadTimeline();
    } catch (error: any) {
      console.error('Failed to submit post:', error);
      setErrorMessage(error.message || 'Failed to post');
      setErrorModalVisible(true);
    }
  };

  const handleReply = useCallback((postId: string) => {
    setPosts((currentPosts) => {
      const post = currentPosts.find(p => p.id === postId);
      if (post) {
        setReplyToPostId(postId);
        setReplyToUsername(post.account.username);
        setComposeVisible(true);
      }
      return currentPosts;
    });
  }, []);

  const handleReblog = useCallback(async (postId: string, currentState: boolean) => {
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
  }, []);

  const handleFavourite = useCallback(async (postId: string, currentState: boolean) => {
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
  }, []);

  const handleBookmark = useCallback(async (postId: string, currentState: boolean) => {
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
  }, []);

  const handleConnect = () => {
    console.log('User tapped connect Mastodon button');
    router.push('/connect-mastodon');
  };

  const headerRight = useCallback(() => (
    <TouchableOpacity
      onPress={handleCompose}
      style={styles.headerButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Compose new post"
      accessibilityHint="Double tap to write a new post"
    >
      <IconSymbol
        ios_icon_name="square.and.pencil"
        android_material_icon_name="edit"
        size={28}
        color={theme.primary}
      />
    </TouchableOpacity>
  ), [theme.primary]);

  // Memoized FlatList helpers for performance
  const keyExtractor = useCallback((item: MastodonPost) => item.id, []);

  const renderItem = useCallback(({ item }: { item: MastodonPost }) => (
    <PostCard
      post={item}
      onReply={handleReply}
      onReblog={handleReblog}
      onFavourite={handleFavourite}
      onBookmark={handleBookmark}
    />
  ), [handleReply, handleReblog, handleFavourite, handleBookmark]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTimeline();
  }, [loadTimeline]);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: textColor }]}>
        No posts yet. Follow some accounts to see their posts here!
      </Text>
    </View>
  ), [textColor]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    const lastPost = posts[posts.length - 1];
    if (lastPost) {
      loadTimeline(lastPost.id);
    }
  }, [loadingMore, hasMore, posts, loadTimeline]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={textColor} />
      </View>
    );
  }, [loadingMore, textColor]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen
          options={{
            title: 'Home',
            headerShown: true,
            headerRight,
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={textColor} />
        </View>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen
          options={{
            title: 'Home',
            headerShown: true,
          }}
        />
        <View style={styles.centerContainer}>
          <IconSymbol
            ios_icon_name="link.circle"
            android_material_icon_name="link"
            size={64}
            color={textColor}
            style={{ marginBottom: 16 }}
          />
          <Text style={[styles.emptyText, { color: textColor }]}>
            Connect your Mastodon account to get started
          </Text>
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Text style={styles.connectButtonText}>Connect Mastodon</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen
        options={{
          title: 'Home',
          headerShown: true,
          headerRight,
        }}
      />

      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={textColor}
          />
        }
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={footerComponent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={posts.length === 0 ? styles.emptyListContent : undefined}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
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
          <View style={[styles.modalContent, { backgroundColor: bgColor }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color="#ff3b30"
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: textColor }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: textColor }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
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
  headerButton: {
    padding: 8,
    marginRight: 8,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  connectButton: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: colors.light.primary,
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
