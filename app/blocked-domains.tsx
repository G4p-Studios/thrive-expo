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
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getDomainBlocks, unblockDomain, type PageCursor } from '@/lib/mastodon';

export default function BlockedDomainsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [domains, setDomains] = useState<string[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getDomainBlocks();
        if (cancelled) return;
        setDomains(response.domains);
        setCursor(response.next);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load blocked domains');
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
      const response = await getDomainBlocks(cursor);
      setDomains(prev => [...prev, ...response.domains]);
      setCursor(response.next);
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const handleUnblock = useCallback(async (domain: string) => {
    setPending(domain);
    setConfirming(null);
    try {
      await unblockDomain(domain);
      setDomains(prev => prev.filter(d => d !== domain));
    } catch (error: any) {
      setErrorMessage(error.message || `Could not unblock ${domain}`);
    } finally {
      setPending(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{ title: 'Blocked servers', headerShown: true, headerBackTitle: 'Back' }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Blocked servers', headerShown: true, headerBackTitle: 'Back' }}
      />

      <FlatList
        data={domains}
        keyExtractor={item => item}
        ListHeaderComponent={
          domains.length > 0 ? (
            <Text style={[styles.intro, { color: theme.textSecondary }]}>
              You see nothing from these servers, and nobody there can follow you.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <IconSymbol
              ios_icon_name="server.rack"
              android_material_icon_name="dns"
              size={22}
              color={theme.textSecondary}
              accessible={false}
            />
            <Text style={[styles.domain, { color: theme.text }]} numberOfLines={1}>
              {item}
            </Text>
            <TouchableOpacity
              style={[styles.button, { borderColor: theme.border }]}
              onPress={() => setConfirming(item)}
              disabled={pending === item}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item}`}
              accessibilityHint="Double tap to allow this server again"
              accessibilityState={{ disabled: pending === item }}
            >
              {pending === item ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.text }]}>Unblock</Text>
              )}
            </TouchableOpacity>
          </View>
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
            <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
              No blocked servers
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              You can block an entire server from the menu on someone&apos;s profile. It hides
              everyone there at once.
            </Text>
          </View>
        }
        contentContainerStyle={domains.length === 0 ? styles.emptyContent : undefined}
      />

      {/* Unblocking does not restore the followers the block removed, so confirm. */}
      <Modal
        visible={confirming !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              Unblock {confirming}?
            </Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              You will see posts from this server again and its people can follow you. Followers
              removed by the block are not restored.
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
                style={[styles.modalButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => confirming && handleUnblock(confirming)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Unblock"
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              style={[styles.modalButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setErrorMessage('')}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  domain: { flex: 1, fontSize: 15, fontWeight: '600' },
  button: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
  footer: { paddingVertical: 20, alignItems: 'center' },
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 19, textAlign: 'center' },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 15, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
});
