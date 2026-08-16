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
import {
  getSuggestions,
  dismissSuggestion,
  getDirectory,
  follow,
  unfollow,
} from '@/lib/mastodon';
import type { MastodonAccount } from '@/types/mastodon';

type Source = 'suggested' | 'directory';

export default function SuggestionsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [source, setSource] = useState<Source>('suggested');
  const [accounts, setAccounts] = useState<MastodonAccount[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        if (source === 'suggested') {
          const result = await getSuggestions();
          if (cancelled) return;
          setAccounts(result.map(s => s.account));
        } else {
          const result = await getDirectory({ order: 'active', local: true });
          if (cancelled) return;
          setAccounts(result);
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(
            error?.status === 404
              ? 'This server does not offer suggestions.'
              : error.message || 'Could not load accounts'
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
  }, [source, reloadToken]);

  const isFollowing = useCallback(
    (account: MastodonAccount) => following[account.id] ?? !!account.following,
    [following]
  );

  const handleToggleFollow = useCallback(async (account: MastodonAccount) => {
    const wasFollowing = following[account.id] ?? !!account.following;

    setPendingId(account.id);
    try {
      const relationship = wasFollowing ? await unfollow(account.id) : await follow(account.id);
      // A locked account gives `requested` rather than `following`; either way
      // the button should stop offering to follow again.
      setFollowing(prev => ({
        ...prev,
        [account.id]: relationship.following || relationship.requested,
      }));
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not update that follow');
    } finally {
      setPendingId(null);
    }
  }, [following]);

  const handleDismiss = useCallback(async (account: MastodonAccount) => {
    setAccounts(prev => prev.filter(a => a.id !== account.id));
    try {
      await dismissSuggestion(account.id);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not dismiss that suggestion');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Who to follow', headerShown: true, headerBackTitle: 'Back' }}
      />

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(
          [
            { value: 'suggested' as Source, label: 'Suggested', hint: 'Based on who you already interact with' },
            { value: 'directory' as Source, label: 'Directory', hint: 'People on this server who opted in' },
          ]
        ).map(option => {
          const selected = source === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.tab, selected && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setSource(option.value)}
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
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

      <AccountList
        accounts={accounts}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setReloadToken(t => t + 1);
        }}
        emptyTitle={source === 'suggested' ? 'No suggestions yet' : 'Nobody listed'}
        emptyBody={
          source === 'suggested'
            ? 'Suggestions appear once you have interacted with a few accounts.'
            : 'Nobody on this server has opted into the public directory.'
        }
        renderActions={account => {
          const busy = pendingId === account.id;
          const followed = isFollowing(account);

          return (
            <>
              {source === 'suggested' && (
                <TouchableOpacity
                  style={[styles.dismissButton, { borderColor: theme.border }]}
                  onPress={() => handleDismiss(account)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss ${account.displayName || account.username}`}
                  accessibilityHint="Stops this account being suggested again"
                >
                  <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Not now</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.followButton,
                  followed
                    ? { borderColor: theme.border, borderWidth: 1 }
                    : { backgroundColor: theme.primary },
                  busy && styles.disabled,
                ]}
                onPress={() => handleToggleFollow(account)}
                disabled={busy}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={
                  followed
                    ? `Unfollow ${account.displayName || account.username}`
                    : `Follow ${account.displayName || account.username}`
                }
                accessibilityState={{ disabled: busy }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={followed ? theme.text : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.followText, { color: followed ? theme.text : '#FFFFFF' }]}>
                    {followed ? 'Following' : 'Follow'}
                  </Text>
                )}
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600' },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 88,
    alignItems: 'center',
  },
  followText: { fontSize: 14, fontWeight: '600' },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  dismissText: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.6 },
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
