import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  getFilter,
  createFilter,
  updateFilter,
  deleteFilter,
  type FilterKeywordInput,
} from '@/lib/mastodon';
import type { FilterAction, FilterContext } from '@/types/mastodon';

const CONTEXTS: { value: FilterContext; label: string; hint: string }[] = [
  { value: 'home', label: 'Home and lists', hint: 'Your main timeline' },
  { value: 'notifications', label: 'Notifications', hint: 'Mentions, boosts and likes' },
  { value: 'public', label: 'Public timelines', hint: 'Local and federated' },
  { value: 'thread', label: 'Conversations', hint: 'Replies under a post' },
  { value: 'account', label: 'Profiles', hint: 'Posts shown on someone’s profile' },
];

const ACTIONS: { value: FilterAction; label: string; hint: string }[] = [
  { value: 'warn', label: 'Hide behind a warning', hint: 'You can still tap to read it' },
  { value: 'hide', label: 'Remove completely', hint: 'You will never see it' },
  { value: 'blur', label: 'Cover the media', hint: 'The text stays readable' },
];

/** `unchanged` leaves an existing filter's expiry alone. */
type ExpiryChoice = 'unchanged' | 'never' | number;

const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 21600, label: '6 hours' },
  { value: 86400, label: '1 day' },
  { value: 604800, label: '1 week' },
];

export default function FilterEditorScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState<FilterKeywordInput[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [contexts, setContexts] = useState<FilterContext[]>(['home']);
  const [action, setAction] = useState<FilterAction>('warn');
  const [expiry, setExpiry] = useState<ExpiryChoice>(isNew ? 'never' : 'unchanged');
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isNew || !id) return;

    let cancelled = false;

    (async () => {
      try {
        const filter = await getFilter(id);
        if (cancelled) return;

        setTitle(filter.title);
        setKeywords(
          filter.keywords.map(k => ({ id: k.id, keyword: k.keyword, wholeWord: k.wholeWord }))
        );
        setContexts(filter.context);
        setAction(filter.filterAction);
        setCurrentExpiresAt(filter.expiresAt);
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error.message || 'Could not load this filter');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const toggleContext = (value: FilterContext) => {
    setContexts(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  };

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    setKeywords(prev => [...prev, { keyword: trimmed, wholeWord: false }]);
    setNewKeyword('');
  };

  const removeKeyword = (index: number) => {
    setKeywords(prev => {
      const target = prev[index];
      // Keywords the server knows about must be sent back marked for removal;
      // ones added in this session can simply be dropped.
      if (target?.id) {
        return prev.map((k, i) => (i === index ? { ...k, destroy: true } : k));
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleWholeWord = (index: number) => {
    setKeywords(prev =>
      prev.map((k, i) => (i === index ? { ...k, wholeWord: !k.wholeWord } : k))
    );
  };

  const visibleKeywords = keywords
    .map((keyword, index) => ({ keyword, index }))
    .filter(entry => !entry.keyword.destroy);

  const canSave =
    title.trim().length > 0 && contexts.length > 0 && visibleKeywords.length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    setSaving(true);
    setErrorMessage('');
    try {
      const input = {
        title,
        context: contexts,
        filterAction: action,
        expiresIn: expiry === 'unchanged' ? undefined : expiry === 'never' ? null : expiry,
        keywords,
      };

      if (isNew) {
        await createFilter(input);
      } else if (id) {
        await updateFilter(id, input);
      }
      router.back();
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not save this filter');
    } finally {
      setSaving(false);
    }
  }, [canSave, title, contexts, action, expiry, keywords, isNew, id, router]);

  const handleDelete = useCallback(async () => {
    if (!id || isNew) return;

    setDeleting(true);
    setConfirmDelete(false);
    try {
      await deleteFilter(id);
      router.back();
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not delete this filter');
      setDeleting(false);
    }
  }, [id, isNew, router]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Filter', headerShown: true, headerBackTitle: 'Back' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Stack.Screen
        options={{
          title: isNew ? 'New filter' : 'Edit filter',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save filter"
              accessibilityState={{ disabled: !canSave }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text
                  style={[
                    styles.saveText,
                    { color: canSave ? theme.primary : theme.textSecondary },
                  ]}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: theme.text }]} accessibilityRole="header">
          Name
        </Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          placeholder="For example: Film spoilers"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
          accessible={true}
          accessibilityLabel="Filter name"
          accessibilityHint="Shown in place of posts this filter hides"
        />

        <Text style={[styles.label, { color: theme.text }]} accessibilityRole="header">
          Words to filter
        </Text>
        <View style={styles.addRow}>
          <TextInput
            style={[
              styles.input,
              styles.addInput,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
            ]}
            placeholder="Add a word or phrase"
            placeholderTextColor={theme.textSecondary}
            value={newKeyword}
            onChangeText={setNewKeyword}
            onSubmitEditing={addKeyword}
            returnKeyType="done"
            accessible={true}
            accessibilityLabel="New keyword"
            accessibilityHint="Type a word, then use the add button"
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: theme.primary },
              !newKeyword.trim() && styles.disabled,
            ]}
            onPress={addKeyword}
            disabled={!newKeyword.trim()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add keyword"
            accessibilityState={{ disabled: !newKeyword.trim() }}
          >
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={20}
              color="#FFFFFF"
              accessible={false}
            />
          </TouchableOpacity>
        </View>

        {visibleKeywords.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Add at least one word. A filter with no words does nothing.
          </Text>
        ) : (
          visibleKeywords.map(({ keyword, index }) => (
            <View
              key={keyword.id ?? `new-${index}`}
              style={[styles.keywordRow, { borderColor: theme.border }]}
            >
              <Text style={[styles.keywordText, { color: theme.text }]} numberOfLines={1}>
                {keyword.keyword}
              </Text>
              <TouchableOpacity
                style={styles.wholeWordToggle}
                onPress={() => toggleWholeWord(index)}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel={`Whole word only for ${keyword.keyword}`}
                accessibilityHint="When on, this only matches the word on its own, not inside longer words"
                accessibilityState={{ checked: !!keyword.wholeWord }}
              >
                <IconSymbol
                  ios_icon_name={keyword.wholeWord ? 'checkmark.square.fill' : 'square'}
                  android_material_icon_name={
                    keyword.wholeWord ? 'check-box' : 'check-box-outline-blank'
                  }
                  size={20}
                  color={keyword.wholeWord ? theme.primary : theme.textSecondary}
                  accessible={false}
                />
                <Text style={[styles.wholeWordLabel, { color: theme.textSecondary }]} accessible={false}>
                  Whole word
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeKeyword(index)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${keyword.keyword}`}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={22}
                  color={theme.textSecondary}
                  accessible={false}
                />
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={[styles.label, { color: theme.text }]} accessibilityRole="header">
          What should happen
        </Text>
        {ACTIONS.map(option => {
          const selected = action === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionRow, { borderColor: selected ? theme.primary : theme.border }]}
              onPress={() => setAction(option.value)}
              accessible={true}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              accessibilityState={{ selected }}
            >
              <IconSymbol
                ios_icon_name={selected ? 'largecircle.fill.circle' : 'circle'}
                android_material_icon_name={
                  selected ? 'radio-button-checked' : 'radio-button-unchecked'
                }
                size={22}
                color={selected ? theme.primary : theme.textSecondary}
                accessible={false}
              />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]} accessible={false}>
                  {option.label}
                </Text>
                <Text style={[styles.optionHint, { color: theme.textSecondary }]} accessible={false}>
                  {option.hint}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.label, { color: theme.text }]} accessibilityRole="header">
          Where it applies
        </Text>
        {CONTEXTS.map(option => {
          const checked = contexts.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionRow, { borderColor: checked ? theme.primary : theme.border }]}
              onPress={() => toggleContext(option.value)}
              accessible={true}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              accessibilityState={{ checked }}
            >
              <IconSymbol
                ios_icon_name={checked ? 'checkmark.square.fill' : 'square'}
                android_material_icon_name={checked ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={checked ? theme.primary : theme.textSecondary}
                accessible={false}
              />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]} accessible={false}>
                  {option.label}
                </Text>
                <Text style={[styles.optionHint, { color: theme.textSecondary }]} accessible={false}>
                  {option.hint}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {contexts.length === 0 && (
          <Text style={[styles.hint, { color: theme.error }]}>
            Choose at least one place for this filter to apply.
          </Text>
        )}

        <Text style={[styles.label, { color: theme.text }]} accessibilityRole="header">
          Expires
        </Text>
        {currentExpiresAt && expiry === 'unchanged' && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Currently expires {new Date(currentExpiresAt).toLocaleString()}. Pick an option below
            to change it.
          </Text>
        )}
        <View style={styles.chips}>
          {EXPIRY_OPTIONS.map(option => {
            const selected = expiry === option.value;
            return (
              <TouchableOpacity
                key={String(option.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                  },
                ]}
                onPress={() => setExpiry(option.value)}
                accessible={true}
                accessibilityRole="radio"
                accessibilityLabel={
                  option.value === 'never' ? 'Never expires' : `Expires in ${option.label}`
                }
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.text }]}
                  accessible={false}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isNew && (
          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: theme.error }]}
            onPress={() => setConfirmDelete(true)}
            disabled={deleting}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Delete filter"
            accessibilityHint="Double tap to remove this filter entirely"
            accessibilityState={{ disabled: deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <Text style={[styles.deleteText, { color: theme.error }]}>Delete filter</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              Delete “{title}”?
            </Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              Posts matching its words will start appearing again.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setConfirmDelete(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.error, borderColor: theme.error }]}
                onPress={handleDelete}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Delete"
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Delete</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  label: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: { flex: 1 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  hint: { fontSize: 13, lineHeight: 18 },
  keywordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  keywordText: { flex: 1, fontSize: 15, fontWeight: '600' },
  wholeWordToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wholeWordLabel: { fontSize: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionText: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionHint: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 14, fontWeight: '600' },
  saveText: { fontSize: 16, fontWeight: '600' },
  deleteButton: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteText: { fontSize: 15, fontWeight: '600' },
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
