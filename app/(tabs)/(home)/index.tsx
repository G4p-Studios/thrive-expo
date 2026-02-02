
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
  Platform,
  Modal,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import ComposeModal from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import React, { useState, useEffect, useCallback } from 'react';
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

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? colors.backgroundDark : colors.backgroundLight;
  const textColor = isDark ? colors.textDark : colors.textLight;

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
      console.log('Loading timeline', maxId ? `with maxId: ${maxId}` : '');
      if (!maxId) {
        setLoading(true);
      }
      const response = await getHomeTimeline(maxId);
      console.log(`Loaded ${response.posts.length} posts from timeline`);

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
    }
  }, []);

  const handleCompose = () => {
    console.log('User tapped compose button');
    setReplyToPostId(undefined);
    setReplyToUsername(undefined);
    setComposeVisible(true);
  };

  const handleSubmitPost = async (content: string) => {
    try {
      console.log('Submitting post:', content, replyToPostId ? `as reply to ${replyToPostId}` : '');

      await createPost(content, {
        inReplyToId: replyToPostId,
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

  const handleConnect = () => {
    console.log('User tapped connect Mastodon button');
    router.push('/connect-mastodon');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen
          options={{
            title: 'Home',
            headerShown: false,
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
            headerShown: false,
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
          headerShown: false,
        }}
      />

      <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: isDark ? '#333' : '#e0e0e0' }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Home</Text>
        <TouchableOpacity onPress={handleCompose} style={styles.composeButton}>
          <IconSymbol
            ios_icon_name="square.and.pencil"
            android_material_icon_name="edit"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

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
            tintColor={textColor}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: textColor }]}>
              No posts yet. Follow some accounts to see their posts here!
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
  composeButton: {
    padding: 8,
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
  connectButton: {
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primary,
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
