import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import AccountList from '@/components/AccountList';
import { getMutedAccounts, unmuteAccount, type PageCursor } from '@/lib/mastodon';
import type { MastodonAccount } from '@/types/mastodon';

export default function MutedAccountsScreen() {
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
        const response = await getMutedAccounts();
        if (cancelled) return;
        setAccounts(response.accounts);
        setCursor(response.next);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load muted accounts');
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
      const response = await getMutedAccounts(cursor);
      setAccounts(prev => [...prev, ...response.accounts]);
      setCursor(response.next);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const handleUnmute = useCallback(async (account: MastodonAccount) => {
    setPendingId(account.id);
    try {
      await unmuteAccount(account.id);
      // Dropping the row is the whole point of the screen, so do it locally
      // rather than re-fetching the whole list.
      setAccounts(prev => prev.filter(a => a.id !== account.id));
    } catch (error: any) {
      setErrorMessage(error.message || `Could not unmute @${account.acct}`);
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Muted accounts', headerShown: true, headerBackTitle: 'Back' }}
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
        emptyTitle="No muted accounts"
        emptyBody="Accounts you mute will appear here, so you can undo it later."
        renderActions={account => (
          <TouchableOpacity
            style={[styles.button, { borderColor: theme.border }]}
            onPress={() => handleUnmute(account)}
            disabled={pendingId === account.id}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Unmute ${account.displayName || account.username}`}
            accessibilityHint="Double tap to see their posts in your timelines again"
            accessibilityState={{ disabled: pendingId === account.id }}
          >
            {pendingId === account.id ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.text }]}>Unmute</Text>
            )}
          </TouchableOpacity>
        )}
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
  button: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
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
