import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import AccountList from '@/components/AccountList';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getFollowRequests,
  authorizeFollowRequest,
  rejectFollowRequest,
  type PageCursor,
} from '@/lib/mastodon';
import type { MastodonAccount } from '@/types/mastodon';

export default function FollowRequestsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [accounts, setAccounts] = useState<MastodonAccount[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getFollowRequests();
        if (cancelled) return;
        setAccounts(response.accounts);
        setCursor(response.next);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load follow requests');
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
  }, [reloadToken]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await getFollowRequests(cursor);
      setAccounts(prev => [...prev, ...response.accounts]);
      setCursor(response.next);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const respond = useCallback(async (account: MastodonAccount, accept: boolean) => {
    setPendingId(account.id);
    try {
      if (accept) {
        await authorizeFollowRequest(account.id);
      } else {
        await rejectFollowRequest(account.id);
      }
      setAccounts(prev => prev.filter(a => a.id !== account.id));
      AccessibilityInfo.announceForAccessibility(
        accept ? `Accepted @${account.acct}` : `Declined @${account.acct}`
      );
    } catch (error: any) {
      setErrorMessage(
        error.message ||
          `Could not ${accept ? 'accept' : 'decline'} the request from @${account.acct}`
      );
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Follow requests', headerShown: true, headerBackTitle: 'Back' }}
      />

      <AccountList
        accounts={accounts}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setReloadToken(t => t + 1);
        }}
        onEndReached={loadMore}
        emptyTitle="No follow requests"
        emptyBody="When your account asks you to approve new followers, their requests wait here."
        renderActions={account => {
          const busy = pendingId === account.id;

          if (busy) {
            return <ActivityIndicator size="small" color={theme.textSecondary} />;
          }

          return (
            <>
              <TouchableOpacity
                style={[styles.iconButton, { borderColor: theme.border }]}
                onPress={() => respond(account, false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${account.displayName || account.username}`}
                accessibilityHint="Double tap to decline. They are not told."
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={18}
                  color={theme.textSecondary}
                  accessible={false}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => respond(account, true)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Accept ${account.displayName || account.username}`}
                accessibilityHint="Double tap to let them follow you"
              >
                <IconSymbol
                  ios_icon_name="checkmark"
                  android_material_icon_name="check"
                  size={18}
                  color="#FFFFFF"
                  accessible={false}
                />
              </TouchableOpacity>
            </>
          );
        }}
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 15, lineHeight: 20 },
  modalButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
