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
  Image,
  Linking,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import PostCard from '@/components/PostCard';
import {
  getTrendingTags,
  getTrendingPosts,
  getTrendingLinks,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
} from '@/lib/mastodon';
import type { MastodonPost, MastodonPreviewCard, MastodonTag } from '@/types/mastodon';

type Section = 'tags' | 'posts' | 'links';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'tags', label: 'Hashtags' },
  { value: 'posts', label: 'Posts' },
  { value: 'links', label: 'Links' },
];

/** People talking about a tag over the days the server reported. */
function tagSummary(tag: MastodonTag): string {
  const uses = tag.history.reduce((sum, day) => sum + (parseInt(day.uses, 10) || 0), 0);
  const people = tag.history.reduce((sum, day) => sum + (parseInt(day.accounts, 10) || 0), 0);

  if (uses === 0) return 'Trending now';
  if (people === 0) return `${uses} ${uses === 1 ? 'post' : 'posts'}`;
  return `${uses} ${uses === 1 ? 'post' : 'posts'} from ${people} ${people === 1 ? 'person' : 'people'}`;
}

export default function TrendsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [section, setSection] = useState<Section>('tags');
  const [tags, setTags] = useState<MastodonTag[]>([]);
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [links, setLinks] = useState<MastodonPreviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Each section is a separate endpoint, so only fetch the visible one.
        if (section === 'tags') {
          const result = await getTrendingTags();
          if (!cancelled) setTags(result);
        } else if (section === 'posts') {
          const result = await getTrendingPosts();
          if (!cancelled) setPosts(result);
        } else {
          const result = await getTrendingLinks();
          if (!cancelled) setLinks(result);
        }
      } catch (error: any) {
        // Trends are optional; a server with them switched off returns 404.
        if (!cancelled) {
          setErrorMessage(
            error?.status === 404
              ? 'This server does not publish trends.'
              : error.message || 'Could not load trends'
          );
        }
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
  }, [section, reloadToken]);

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

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setReloadToken(t => t + 1);
      }}
      tintColor={theme.text}
    />
  );

  const emptyFor = (what: string) => (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        No trending {what} right now.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Trending', headerShown: true, headerBackTitle: 'Back' }} />

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {SECTIONS.map(option => {
          const selected = section === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.tab, selected && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setSection(option.value)}
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.tabText, { color: selected ? theme.primary : theme.textSecondary }]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : section === 'tags' ? (
        <FlatList
          data={tags}
          keyExtractor={item => item.name}
          refreshControl={refreshControl}
          ListEmptyComponent={emptyFor('hashtags')}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: theme.border }]}
              onPress={() => router.push(`/tag/${encodeURIComponent(item.name)}` as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Hashtag ${item.name}. ${tagSummary(item)}`}
              accessibilityHint="Double tap to see posts with this hashtag"
            >
              <View style={styles.rowText}>
                <Text style={[styles.tagName, { color: theme.text }]} accessible={false}>
                  #{item.name}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]} accessible={false}>
                  {tagSummary(item)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : section === 'posts' ? (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          refreshControl={refreshControl}
          ListEmptyComponent={emptyFor('posts')}
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
        />
      ) : (
        <FlatList
          data={links}
          keyExtractor={item => item.url}
          refreshControl={refreshControl}
          ListEmptyComponent={emptyFor('links')}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.linkRow, { borderBottomColor: theme.border }]}
              onPress={() => Linking.openURL(item.url).catch(() => setErrorMessage('Could not open that link'))}
              accessible={true}
              accessibilityRole="link"
              accessibilityLabel={`${item.title}${item.providerName ? `, from ${item.providerName}` : ''}`}
              accessibilityHint="Double tap to open in your browser"
            >
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={[styles.linkImage, { backgroundColor: theme.card }]}
                  accessible={false}
                  importantForAccessibility="no"
                />
              ) : null}
              <View style={styles.rowText} accessible={false}>
                {item.providerName ? (
                  <Text style={[styles.linkProvider, { color: theme.textSecondary }]} accessible={false}>
                    {item.providerName}
                  </Text>
                ) : null}
                <Text
                  style={[styles.linkTitle, { color: theme.text }]}
                  numberOfLines={3}
                  accessible={false}
                >
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          )}
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
              Trends unavailable
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600' },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  rowText: { flex: 1, gap: 3 },
  tagName: { fontSize: 17, fontWeight: '700' },
  rowMeta: { fontSize: 13 },
  linkRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  linkImage: { width: 72, height: 72, borderRadius: 8 },
  linkProvider: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  linkTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
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
