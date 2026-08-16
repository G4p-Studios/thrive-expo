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
  Image,
  Modal,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import PostCard from '@/components/PostCard';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getAccount,
  getAccountStatuses,
  getRelationships,
  getAccountCache,
  follow,
  unfollow,
  muteAccount,
  unmuteAccount,
  blockAccount,
  unblockAccount,
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
  stripHtml,
} from '@/lib/mastodon';
import type { MastodonAccount, MastodonPost, MastodonRelationship } from '@/types/mastodon';

function formatCount(value?: number): string {
  const n = value ?? 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

type PendingAction = 'block' | 'mute' | null;

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [account, setAccount] = useState<MastodonAccount | null>(null);
  const [relationship, setRelationship] = useState<MastodonRelationship | null>(null);
  const [posts, setPosts] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentAccountId, setCurrentAccountId] = useState<string | undefined>(undefined);
  const [reportVisible, setReportVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirming, setConfirming] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  }, []);

  useEffect(() => {
    getAccountCache()
      .then(cached => setCurrentAccountId(cached?.id))
      .catch(() => {
        // Only used to hide actions on your own profile.
      });
  }, []);

  // Bumped to re-run the load; pull-to-refresh increments it rather than
  // calling a loader that would setState straight from the effect body.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      try {
        const [fetchedAccount, relationships, statuses] = await Promise.all([
          getAccount(id),
          getRelationships([id]),
          getAccountStatuses(id),
        ]);
        if (cancelled) return;

        setAccount(fetchedAccount);
        setRelationship(relationships[0] ?? null);
        setPosts(statuses.posts);
        setNextMaxId(statuses.nextMaxId);
        setHasMore(statuses.posts.length > 0);
      } catch (error: any) {
        if (!cancelled) showError(error.message || 'Could not load this profile');
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
  }, [id, reloadToken, showError]);

  const loadMore = useCallback(async () => {
    if (!id || !nextMaxId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const response = await getAccountStatuses(id, nextMaxId);
      if (response.posts.length === 0) {
        setHasMore(false);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
        setNextMaxId(response.nextMaxId);
      }
    } catch (error: any) {
      showError(error.message || 'Could not load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [id, nextMaxId, loadingMore, hasMore, showError]);

  const updatePost = useCallback((postId: string, updater: (p: MastodonPost) => MastodonPost) => {
    setPosts(prev => prev.map(p => (p.id === postId ? updater(p) : p)));
  }, []);

  const handleToggleFollow = useCallback(async () => {
    if (!account || busy) return;

    // A pending request counts as "already asked", so the button withdraws it.
    const wasFollowingOrRequested = !!relationship?.following || !!relationship?.requested;
    setBusy(true);
    try {
      const updated = wasFollowingOrRequested
        ? await unfollow(account.id)
        : await follow(account.id);
      // Taken wholesale from the server so `requested` is right for locked accounts.
      setRelationship(updated);
    } catch (error: any) {
      showError(
        error.message || (wasFollowingOrRequested ? 'Could not unfollow' : 'Could not follow')
      );
    } finally {
      setBusy(false);
    }
  }, [account, relationship, busy, showError]);

  const handleToggleMute = useCallback(async () => {
    if (!account || busy) return;

    const wasMuted = !!relationship?.muting;
    setBusy(true);
    try {
      const updated = wasMuted ? await unmuteAccount(account.id) : await muteAccount(account.id);
      setRelationship(updated);
    } catch (error: any) {
      showError(error.message || 'Could not update mute');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }, [account, relationship, busy, showError]);

  const handleToggleBlock = useCallback(async () => {
    if (!account || busy) return;

    const wasBlocked = !!relationship?.blocking;
    setBusy(true);
    try {
      const updated = wasBlocked ? await unblockAccount(account.id) : await blockAccount(account.id);
      setRelationship(updated);
      // Blocking removes the follow relationship server-side too.
      if (!wasBlocked) setPosts([]);
    } catch (error: any) {
      showError(error.message || 'Could not update block');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }, [account, relationship, busy, showError]);

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
      showError(error.message || 'Failed to boost');
    }
  }, [updatePost, showError]);

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
      showError(error.message || 'Failed to like');
    }
  }, [updatePost, showError]);

  const handleBookmark = useCallback(async (postId: string, currentState: boolean) => {
    updatePost(postId, p => ({ ...p, bookmarked: !currentState }));
    try {
      if (currentState) await unbookmark(postId);
      else await bookmark(postId);
    } catch (error: any) {
      updatePost(postId, p => ({ ...p, bookmarked: currentState }));
      showError(error.message || 'Failed to bookmark');
    }
  }, [updatePost, showError]);

  const handleReply = useCallback((postId: string) => {
    router.push(`/post/${postId}` as any);
  }, [router]);

  const handlePostPress = useCallback((postId: string) => {
    router.push(`/post/${postId}` as any);
  }, [router]);

  const isSelf = !!currentAccountId && account?.id === currentAccountId;
  const bio = account?.note ? stripHtml(account.note) : '';

  const followLabel = relationship?.blocking
    ? 'Blocked'
    : relationship?.requested
      ? 'Requested'
      : relationship?.following
        ? 'Following'
        : account?.locked
          ? 'Request to follow'
          : 'Follow';

  const renderHeader = () => {
    if (!account) return null;

    return (
      <View>
        {account.header ? (
          <Image
            source={{ uri: account.header }}
            style={styles.headerImage}
            accessible={false}
            importantForAccessibility="no"
          />
        ) : (
          <View style={[styles.headerImage, { backgroundColor: theme.card }]} />
        )}

        <View style={styles.profileBody}>
          <Image
            source={{ uri: account.avatar }}
            style={[styles.avatar, { borderColor: theme.background, backgroundColor: theme.card }]}
            accessible={false}
            importantForAccessibility="no"
          />

          <View
            style={styles.identity}
            accessible={true}
            accessibilityLabel={`${account.displayName || account.username}, @${account.acct}${
              account.bot ? ', automated account' : ''
            }${account.locked ? ', approves followers manually' : ''}${
              relationship?.followedBy ? ', follows you' : ''
            }`}
          >
            <Text style={[styles.displayName, { color: theme.text }]} accessible={false}>
              {account.displayName || account.username}
            </Text>
            <Text style={[styles.acct, { color: theme.textSecondary }]} accessible={false}>
              @{account.acct}
            </Text>
            <View style={styles.badges} accessible={false}>
              {/* `locked` means following needs the owner's approval, so say so
                  before someone taps a button that only sends a request. */}
              {account.locked && (
                <View
                  style={[styles.lockedBadge, { borderColor: theme.primary }]}
                  accessible={false}
                >
                  <IconSymbol
                    ios_icon_name="lock.fill"
                    android_material_icon_name="lock"
                    size={11}
                    color={theme.primary}
                    accessible={false}
                  />
                  <Text style={[styles.lockedBadgeText, { color: theme.primary }]} accessible={false}>
                    Approves followers
                  </Text>
                </View>
              )}
              {account.bot && (
                <Text style={[styles.badge, { color: theme.textSecondary, borderColor: theme.border }]}>
                  Automated
                </Text>
              )}
              {relationship?.followedBy && (
                <Text style={[styles.badge, { color: theme.textSecondary, borderColor: theme.border }]}>
                  Follows you
                </Text>
              )}
            </View>
          </View>

          {account.locked && !relationship?.following && !relationship?.blocking && (
            <Text style={[styles.lockedNote, { color: theme.textSecondary }]}>
              {relationship?.requested
                ? 'Your request is waiting for them to approve it.'
                : 'They approve followers by hand, so following sends a request.'}
            </Text>
          )}

          {!isSelf && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  relationship?.following || relationship?.blocking
                    ? { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 }
                    : { backgroundColor: theme.primary },
                  busy && styles.actionDisabled,
                ]}
                onPress={handleToggleFollow}
                disabled={busy || !!relationship?.blocking}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={followLabel}
                accessibilityHint={
                  relationship?.blocking
                    ? 'Unblock this account before following it'
                    : relationship?.following
                      ? 'Double tap to unfollow'
                      : 'Double tap to follow'
                }
                accessibilityState={{ disabled: busy || !!relationship?.blocking }}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    {
                      color:
                        relationship?.following || relationship?.blocking ? theme.text : '#FFFFFF',
                    },
                  ]}
                >
                  {followLabel}
                </Text>
              </TouchableOpacity>

              {/* Mute, block and report live behind a menu — none of them
                  should be one stray tap away from Follow. */}
              <TouchableOpacity
                style={[styles.iconButton, { borderColor: theme.border }]}
                onPress={() => setMenuVisible(true)}
                disabled={busy}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="More actions"
                accessibilityHint="Double tap for options including muting, blocking and reporting"
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
          )}

          {bio ? (
            <Text style={[styles.bio, { color: theme.text }]}>{bio}</Text>
          ) : null}

          <View
            style={[styles.stats, { borderColor: theme.border }]}
            accessible={true}
            accessibilityLabel={`${account.statusesCount ?? 0} posts, ${
              account.followingCount ?? 0
            } following, ${account.followersCount ?? 0} followers`}
          >
            <View style={styles.stat} accessible={false}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(account.statusesCount)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Posts</Text>
            </View>
            <View style={styles.stat} accessible={false}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(account.followingCount)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Following</Text>
            </View>
            <View style={styles.stat} accessible={false}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(account.followersCount)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Followers</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Profile', headerShown: true, headerBackTitle: 'Back' }} />
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
          title: account ? `@${account.acct}` : 'Profile',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReply={handleReply}
            onReblog={handleReblog}
            onFavourite={handleFavourite}
            onBookmark={handleBookmark}
            onPress={handlePostPress}
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
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {relationship?.blocking
                ? 'You have blocked this account.'
                : 'No posts to show.'}
            </Text>
          </View>
        }
      />

      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={account ? `@${account.acct}` : undefined}
        items={[
          {
            key: 'mute',
            label: relationship?.muting ? 'Unmute' : 'Mute',
            hint: relationship?.muting
              ? 'See their posts in your timelines again'
              : 'Hide their posts from your timelines. They are not told.',
            ios: relationship?.muting ? 'speaker.wave.2' : 'speaker.slash',
            android: relationship?.muting ? 'volume-up' : 'volume-off',
            onPress: () => (relationship?.muting ? handleToggleMute() : setConfirming('mute')),
          },
          {
            key: 'block',
            label: relationship?.blocking ? 'Unblock' : 'Block',
            hint: relationship?.blocking
              ? 'Allow them to follow you and see your posts again'
              : 'Stop them following you or seeing your posts',
            ios: relationship?.blocking ? 'hand.raised.slash' : 'hand.raised',
            android: relationship?.blocking ? 'check-circle' : 'block',
            destructive: !relationship?.blocking,
            onPress: () => (relationship?.blocking ? handleToggleBlock() : setConfirming('block')),
          },
          {
            key: 'report',
            label: 'Report account',
            hint: 'Send this account to the moderators for review',
            ios: 'flag',
            android: 'flag',
            destructive: true,
            onPress: () => setReportVisible(true),
          },
        ]}
      />

      {account && (
        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          account={account}
        />
      )}

      {/* Confirmation for the two actions that change what you can see */}
      <Modal
        visible={confirming !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              {confirming === 'block' ? 'Block this account?' : 'Mute this account?'}
            </Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              {confirming === 'block'
                ? `@${account?.acct} will not be able to follow you or see your posts, and you will not see theirs. They are not told.`
                : `You will stop seeing posts from @${account?.acct} in your timelines. They are not told, and you stay connected.`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setConfirming(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.error, borderColor: theme.error }]}
                onPress={confirming === 'block' ? handleToggleBlock : handleToggleMute}
                disabled={busy}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={confirming === 'block' ? 'Block' : 'Mute'}
                accessibilityState={{ disabled: busy }}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    {confirming === 'block' ? 'Block' : 'Mute'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Errors */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              Something went wrong
            </Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerImage: { width: '100%', height: 130 },
  profileBody: { paddingHorizontal: 16, paddingBottom: 12 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    marginTop: -38,
  },
  identity: { marginTop: 10, gap: 2 },
  displayName: { fontSize: 21, fontWeight: '700' },
  acct: { fontSize: 15 },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockedBadgeText: { fontSize: 11, fontWeight: '700' },
  lockedNote: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  followButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
  },
  followButtonText: { fontSize: 15, fontWeight: '600' },
  actionDisabled: { opacity: 0.6 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: { fontSize: 15, lineHeight: 21, marginTop: 14 },
  stats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  footerLoading: { paddingVertical: 20, alignItems: 'center' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 15, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 6,
  },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
});
