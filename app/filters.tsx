import React, { useState, useCallback } from 'react';
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
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getFilters } from '@/lib/mastodon';
import type { FilterAction, MastodonFilter } from '@/types/mastodon';

const CONTEXT_LABELS: Record<string, string> = {
  home: 'Home',
  notifications: 'Notifications',
  public: 'Public timelines',
  thread: 'Conversations',
  account: 'Profiles',
};

const ACTION_LABELS: Record<FilterAction, string> = {
  warn: 'Hide behind a warning',
  hide: 'Remove completely',
  blur: 'Cover the media',
};

export default function FiltersScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [filters, setFilters] = useState<MastodonFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Captured when the list loads, so deciding whether a filter has lapsed does
  // not mean reading the clock during render.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const loadFilters = useCallback(async () => {
    try {
      const result = await getFilters();
      setFilters(result);
      setLoadedAt(Date.now());
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not load your filters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Runs on every focus, so returning from the editor shows the saved change
  // without needing a manual refresh.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!cancelled) await loadFilters();
      })();

      return () => {
        cancelled = true;
      };
    }, [loadFilters])
  );

  const describeExpiry = (filter: MastodonFilter) => {
    if (!filter.expiresAt) return null;
    const expires = new Date(filter.expiresAt);
    return expires.getTime() <= loadedAt ? 'Expired' : `Until ${expires.toLocaleDateString()}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Filters',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/filter/new' as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add filter"
              accessibilityHint="Double tap to create a new keyword filter"
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={filters}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            filters.length > 0 ? (
              <Text style={[styles.intro, { color: theme.textSecondary }]}>
                Posts matching these keywords are filtered by your server before they reach you.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const expiry = describeExpiry(item);
            const keywordText = item.keywords.map(k => k.keyword).join(', ');
            const contextText = item.context
              .map(c => CONTEXT_LABELS[c] ?? c)
              .join(', ');

            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: theme.border }]}
                onPress={() => router.push(`/filter/${item.id}` as any)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${
                  item.keywords.length
                    ? `Keywords: ${keywordText}.`
                    : 'No keywords yet.'
                } ${ACTION_LABELS[item.filterAction]}. Applies to ${contextText}.${
                  expiry ? ` ${expiry}.` : ''
                }`}
                accessibilityHint="Double tap to edit this filter"
              >
                <View style={styles.rowText}>
                  <View style={styles.titleRow} accessible={false}>
                    <Text
                      style={[styles.title, { color: theme.text }]}
                      numberOfLines={1}
                      accessible={false}
                    >
                      {item.title}
                    </Text>
                    {expiry ? (
                      <Text
                        style={[
                          styles.expiry,
                          { color: expiry === 'Expired' ? theme.error : theme.textSecondary },
                        ]}
                        accessible={false}
                      >
                        {expiry}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.keywords, { color: theme.textSecondary }]}
                    numberOfLines={2}
                    accessible={false}
                  >
                    {keywordText || 'No keywords yet'}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]} accessible={false}>
                    {ACTION_LABELS[item.filterAction]} · {contextText}
                  </Text>
                </View>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={theme.textSecondary}
                  accessible={false}
                />
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFilters();
              }}
              tintColor={theme.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
                No filters yet
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Filters hide posts containing words you would rather not see. Tap the plus button
                to make one.
              </Text>
            </View>
          }
          contentContainerStyle={filters.length === 0 ? styles.emptyContent : undefined}
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
  intro: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  expiry: { fontSize: 12, fontWeight: '600' },
  keywords: { fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 12 },
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
  modalButton: { marginTop: 6, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  modalButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
