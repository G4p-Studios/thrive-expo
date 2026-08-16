import React from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { stripHtml } from '@/lib/mastodon';
import type { MastodonAccount } from '@/types/mastodon';

interface AccountListProps {
  accounts: MastodonAccount[];
  loading: boolean;
  loadingMore?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
  emptyTitle: string;
  emptyBody: string;
  /** Buttons shown on the right of each row. */
  renderActions: (account: MastodonAccount) => React.ReactNode;
}

/**
 * A list of accounts with per-row actions.
 *
 * Shared by the blocked, muted and follow-request screens, which differ only in
 * what the buttons on the right do.
 */
export default function AccountList({
  accounts,
  loading,
  loadingMore,
  refreshing,
  onRefresh,
  onEndReached,
  emptyTitle,
  emptyBody,
  renderActions,
}: AccountListProps) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <FlatList
      data={accounts}
      keyExtractor={item => item.id}
      renderItem={({ item }) => {
        const bio = item.note ? stripHtml(item.note) : '';

        return (
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={styles.identity}
              onPress={() => router.push(`/account/${item.id}` as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName || item.username}, @${item.acct}`}
              accessibilityHint="Double tap to open this profile"
            >
              <Image
                source={{ uri: item.avatar }}
                style={[styles.avatar, { backgroundColor: theme.card }]}
                accessible={false}
                importantForAccessibility="no"
              />
              <View style={styles.identityText}>
                <Text
                  style={[styles.displayName, { color: theme.text }]}
                  numberOfLines={1}
                  accessible={false}
                >
                  {item.displayName || item.username}
                </Text>
                <Text
                  style={[styles.acct, { color: theme.textSecondary }]}
                  numberOfLines={1}
                  accessible={false}
                >
                  @{item.acct}
                </Text>
                {bio ? (
                  <Text
                    style={[styles.bio, { color: theme.textSecondary }]}
                    numberOfLines={2}
                    accessible={false}
                  >
                    {bio}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>

            <View style={styles.actions}>{renderActions(item)}</View>
          </View>
        );
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
      }
      onEndReached={onEndReached}
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
            {emptyTitle}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{emptyBody}</Text>
        </View>
      }
      contentContainerStyle={accounts.length === 0 ? styles.emptyContent : undefined}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  identityText: { flex: 1, gap: 1 },
  displayName: { fontSize: 15, fontWeight: '600' },
  acct: { fontSize: 13 },
  bio: { fontSize: 13, lineHeight: 17, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 19, textAlign: 'center' },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
});
