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
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getFollowedTags, unfollowTag } from '@/lib/mastodon';
import type { MastodonTag } from '@/types/mastodon';

export default function FollowedTagsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [tags, setTags] = useState<MastodonTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getFollowedTags();
        if (!cancelled) setTags(result);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load your hashtags');
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

  const handleUnfollow = useCallback(async (tag: MastodonTag) => {
    setPendingName(tag.name);
    try {
      await unfollowTag(tag.name);
      setTags(prev => prev.filter(t => t.name !== tag.name));
    } catch (error: any) {
      setErrorMessage(error.message || `Could not unfollow #${tag.name}`);
    } finally {
      setPendingName(null);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: 'Followed hashtags', headerShown: true, headerBackTitle: 'Back' }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={tags}
          keyExtractor={item => item.name}
          ListHeaderComponent={
            tags.length > 0 ? (
              <Text style={[styles.intro, { color: theme.textSecondary }]}>
                Posts using these hashtags appear in your home timeline.
              </Text>
            ) : null
          }
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
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => router.push(`/tag/${encodeURIComponent(item.name)}` as any)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Hashtag ${item.name}`}
                accessibilityHint="Double tap to see posts with this hashtag"
              >
                <IconSymbol
                  ios_icon_name="number"
                  android_material_icon_name="tag"
                  size={20}
                  color={theme.textSecondary}
                  accessible={false}
                />
                <Text style={[styles.tagName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { borderColor: theme.border }]}
                onPress={() => handleUnfollow(item)}
                disabled={pendingName === item.name}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Unfollow ${item.name}`}
                accessibilityHint="Stops these posts appearing in your home timeline"
                accessibilityState={{ disabled: pendingName === item.name }}
              >
                {pendingName === item.name ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Text style={[styles.buttonText, { color: theme.text }]}>Unfollow</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
                No followed hashtags
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Open a hashtag and tap Follow to mix its posts into your home timeline.
              </Text>
            </View>
          }
          contentContainerStyle={tags.length === 0 ? styles.emptyContent : undefined}
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
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tagName: { flex: 1, fontSize: 16, fontWeight: '600' },
  button: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 88,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
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
