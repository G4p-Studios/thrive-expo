
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
  Modal,
  TextInput,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import ComposeModal from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import React, { useState, useEffect, useCallback } from 'react';
import { MastodonPost, MastodonAccount, SearchResponse } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getPublicTimeline,
  search,
  createPost,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
  follow,
  unfollow,
} from '@/lib/mastodon';

// Helper to resolve image sources
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

type ViewMode = 'public' | 'local' | 'search';

export default function ExploreScreen() {
  const colorScheme = useColorScheme();
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<string | undefined>(undefined);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'accounts' | 'statuses' | 'hashtags'>('statuses');

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('ExploreScreen mounted, loading public timeline');
    loadPublicTimeline();
  }, []);

  const loadPublicTimeline = useCallback(async (maxId?: string, local: boolean = false) => {
    try {
      console.log('Loading public timeline', local ? '(local)' : '(federated)', maxId ? `with maxId: ${maxId}` : '');
      if (!maxId) {
        setLoading(true);
      }
      const response = await getPublicTimeline(maxId, local);
      console.log(`Loaded ${response.posts.length} posts from public timeline`);

      if (maxId) {
        setPosts((prev) => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
      setSearchResults(null);
    } catch (error: any) {
      console.error('Failed to load public timeline:', error);
      setErrorMessage(error.message || 'Failed to load timeline');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      return;
    }

    try {
      console.log('Searching for:', searchQuery, 'type:', searchType);
      setLoading(true);
      const response = await search(searchQuery, searchType);
      console.log('Search results:', response);
      setSearchResults(response);
      setPosts(response.statuses || []);
    } catch (error: any) {
      console.error('Failed to search:', error);
      setErrorMessage(error.message || 'Failed to search');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchType]);

  const handleViewModeChange = (mode: ViewMode) => {
    console.log('Changing view mode to:', mode);
    setViewMode(mode);
    setSearchQuery('');
    setSearchResults(null);
    
    if (mode === 'public') {
      loadPublicTimeline(undefined, false);
    } else if (mode === 'local') {
      loadPublicTimeline(undefined, true);
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

  const handleFollowAccount = async (accountId: string, currentState: boolean) => {
    console.log(`User tapped ${currentState ? 'unfollow' : 'follow'} account:`, accountId);

    try {
      if (currentState) {
        await unfollow(accountId);
      } else {
        await follow(accountId);
      }
      console.log('Follow action completed');

      // Update search results if present
      if (searchResults) {
        setSearchResults({
          ...searchResults,
          accounts: searchResults.accounts.map(acc =>
            acc.id === accountId ? { ...acc, following: !currentState } : acc
          ),
        });
      }
    } catch (error: any) {
      console.error('Failed to follow/unfollow:', error);
      setErrorMessage(error.message || 'Failed to follow/unfollow');
      setErrorModalVisible(true);
    }
  };

  const renderAccount = ({ item }: { item: MastodonAccount }) => (
    <View style={[styles.accountCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Image
        source={resolveImageSource(item.avatar)}
        style={styles.accountAvatar}
        accessibilityLabel={`${item.displayName || item.username}'s avatar`}
      />
      <View style={styles.accountInfo}>
        <Text style={[styles.accountDisplayName, { color: theme.text }]} numberOfLines={1}>
          {item.displayName || item.username}
        </Text>
        <Text style={[styles.accountUsername, { color: theme.textSecondary }]} numberOfLines={1}>
          @{item.username}
        </Text>
        {item.note && (
          <Text style={[styles.accountNote, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.note.replace(/<[^>]*>/g, '')}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.followButton,
          { 
            backgroundColor: item.following ? 'transparent' : theme.primary,
            borderColor: theme.primary,
            borderWidth: item.following ? 1 : 0,
          }
        ]}
        onPress={() => handleFollowAccount(item.id!, item.following || false)}
      >
        <Text style={[styles.followButtonText, { color: item.following ? theme.primary : '#fff' }]}>
          {item.following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Explore',
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
          title: 'Explore',
          headerShown: true,
        }}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={theme.textSecondary}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search posts, accounts, hashtags..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* View Mode Tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'public' && styles.tabActive]}
          onPress={() => handleViewModeChange('public')}
        >
          <Text style={[styles.tabText, { color: viewMode === 'public' ? theme.primary : theme.textSecondary }]}>
            Public
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => handleViewModeChange('local')}
        >
          <Text style={[styles.tabText, { color: viewMode === 'local' ? theme.primary : theme.textSecondary }]}>
            Local
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'search' && styles.tabActive]}
          onPress={() => {
            setViewMode('search');
            if (searchQuery) handleSearch();
          }}
        >
          <Text style={[styles.tabText, { color: viewMode === 'search' ? theme.primary : theme.textSecondary }]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Type Selector (only visible in search mode) */}
      {viewMode === 'search' && (
        <View style={[styles.searchTypeTabs, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.searchTypeTab, searchType === 'statuses' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setSearchType('statuses')}
          >
            <Text style={[styles.searchTypeText, { color: searchType === 'statuses' ? theme.primary : theme.textSecondary }]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchTypeTab, searchType === 'accounts' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setSearchType('accounts')}
          >
            <Text style={[styles.searchTypeText, { color: searchType === 'accounts' ? theme.primary : theme.textSecondary }]}>
              Accounts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchTypeTab, searchType === 'hashtags' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setSearchType('hashtags')}
          >
            <Text style={[styles.searchTypeText, { color: searchType === 'hashtags' ? theme.primary : theme.textSecondary }]}>
              Hashtags
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {viewMode === 'search' && searchResults && searchType === 'accounts' ? (
        <FlatList
          data={searchResults.accounts}
          keyExtractor={(item) => item.id || item.username}
          renderItem={renderAccount}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.text }]}>
                No accounts found
              </Text>
            </View>
          }
        />
      ) : (
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
                if (viewMode === 'public') {
                  loadPublicTimeline(undefined, false);
                } else if (viewMode === 'local') {
                  loadPublicTimeline(undefined, true);
                } else {
                  handleSearch();
                }
              }}
              tintColor={theme.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={64}
                color={theme.textSecondary}
                style={{ marginBottom: 16 }}
              />
              <Text style={[styles.emptyText, { color: theme.text }]}>
                {viewMode === 'search' ? 'Search for posts, accounts, or hashtags' : 'No posts found'}
              </Text>
            </View>
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyListContent : undefined}
        />
      )}

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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchTypeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  searchTypeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountUsername: {
    fontSize: 14,
    marginBottom: 4,
  },
  accountNote: {
    fontSize: 14,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
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
