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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import PostCard from '@/components/PostCard';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getTag,
  followTag,
  unfollowTag,
  getHashtagTimeline,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
} from '@/lib/mastodon';
import type { MastodonPost, MastodonTag } from '@/types/mastodon';

/** Total uses across the history the server returned. */
function totalUses(tag: MastodonTag | null): number {
  if (!tag) return 0;
  return tag.history.reduce((sum, day) => sum + (parseInt(day.uses, 10) || 0), 0);
}

export default function TagTimelineScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [tag, setTag] = useState<MastodonTag | null>(null);
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!name) return;

    let cancelled = false;

    (async () => {
      try {
        // The tag lookup tells us whether it is followed; the timeline is the
        // content. A server that hides tag metadata should not block the posts.
        const [tagResult, timeline] = await Promise.all([
          getTag(name).catch(() => null),
          getHashtagTimeline(name),
        ]);
        if (cancelled) return;

        setTag(tagResult);
        setPosts(timeline.posts);
        setNextMaxId(timeline.nextMaxId);
        setHasMore(timeline.posts.length > 0);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load this hashtag');
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
  }, [name, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!name || !nextMaxId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const response = await getHashtagTimeline(name, nextMaxId);
      if (response.posts.length === 0) {
        setHasMore(false);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
        setNextMaxId(response.nextMaxId);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [name, nextMaxId, loadingMore, hasMore]);

  const toggleFollow = useCallback(async () => {
    if (!name || busy) return;

    const wasFollowing = !!tag?.following;
    setBusy(true);
    try {
      const updated = wasFollowing ? await unfollowTag(name) : await followTag(name);
      setTag(updated);
    } catch (error: any) {
      setErrorMessage(
        error.message || (wasFollowing ? 'Could not unfollow that hashtag' : 'Could not follow that hashtag')
      );
    } finally {
      setBusy(false);
    }
  }, [name, tag, busy]);

  const updatePost = useCallback((postId: string, updater: (p: MastodonPost) => MastodonPost) => {
    setPosts(prev => prev.map(p => (p.id === postId ? updater(p) : p)));
  }, []);

  const handleReblog = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({
      ...p,
      reblogged: !currentState,
      reblogsCount: (p.reblogsCount || 0) + (currentState ? -1 : 1),
    }));
    try {
      if (currentState) await unreblog(postId);
      else await reblog(postId);
    } catch (error: any) {
      updatePost(postId, p => ({
        ...p,
        reblogged: currentState,
        reblogsCount: (p.reblogsCount || 0) + (currentState ? 1 : -1),
      }));
      setErrorMessage(error.message || 'Failed to boost');
    }
  }, [updatePost]);

  const handleFavourite = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({
      ...p,
      favourited: !currentState,
      favouritesCount: (p.favouritesCount || 0) + (currentState ? -1 : 1),
    }));
    try {
      if (currentState) await unfavourite(postId);
      else await favourite(postId);
    } catch (error: any) {
      updatePost(postId, p => ({
        ...p,
        favourited: currentState,
        favouritesCount: (p.favouritesCount || 0) + (currentState ? 1 : -1),
      }));
      setErrorMessage(error.message || 'Failed to like');
    }
  }, [updatePost]);

  const handleBookmark = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({ ...p, bookmarked: !currentState }));
    try {
      if (currentState) await unbookmark(postId);
      else await bookmark(postId);
    } catch (error: any) {
      updatePost(postId, p => ({ ...p, bookmarked: currentState }));
      setErrorMessage(error.message || 'Failed to bookmark');
    }
  }, [updatePost]);

  const openPost = useCallback((postId: string) => {
    router.push(`/post/${postId}` as any);
  }, [router]);

  const uses = totalUses(tag);
  const following = !!tag?.following;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: `#${name}`, headerShown: true, headerBackTitle: 'Back' }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <View style={styles.headerText}>
                <Text style={[styles.tagName, { color: theme.text }]}>#{name}</Text>
                {uses > 0 && (
                  <Text style={[styles.tagMeta, { color: theme.textSecondary }]}>
                    {uses} {uses === 1 ? 'post' : 'posts'} this week
                  </Text>
                )}
              </View>
              {tag && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    following
                      ? { borderColor: theme.border, borderWidth: 1 }
                      : { backgroundColor: theme.primary },
                    busy && styles.disabled,
                  ]}
                  onPress={toggleFollow}
                  disabled={busy}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={following ? `Unfollow hashtag ${name}` : `Follow hashtag ${name}`}
                  accessibilityHint={
                    following
                      ? 'Stops these posts appearing in your home timeline'
                      : 'Adds these posts to your home timeline'
                  }
                  accessibilityState={{ disabled: busy }}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={following ? theme.text : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={[styles.followText, { color: following ? theme.text : '#FFFFFF' }]}
                    >
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onReply={openPost}
              onReblog={handleReblog}
              onFavourite={handleFavourite}
              onBookmark={handleBookmark}
              onPress={openPost}
            />
          )}
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
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nothing has been posted with this hashtag yet.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, gap: 2 },
  tagName: { fontSize: 20, fontWeight: '700' },
  tagMeta: { fontSize: 13 },
  followButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 96,
    alignItems: 'center',
  },
  followText: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
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
