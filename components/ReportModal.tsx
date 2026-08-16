import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  createReport,
  getInstanceConfig,
  DEFAULT_INSTANCE_CONFIG,
  REPORT_COMMENT_MAX_LENGTH,
} from '@/lib/mastodon';
import type {
  MastodonAccount,
  MastodonInstanceConfig,
  MastodonPost,
  ReportCategory,
} from '@/types/mastodon';

const CATEGORIES: { value: ReportCategory; label: string; hint: string }[] = [
  {
    value: 'spam',
    label: 'Spam',
    hint: 'Malicious links, fake engagement, or repetitive replies',
  },
  {
    value: 'violation',
    label: 'It breaks a server rule',
    hint: 'You know it breaks a specific rule',
  },
  {
    value: 'legal',
    label: 'It is illegal',
    hint: 'You believe it breaks the law of your or the server’s country',
  },
  {
    value: 'other',
    label: 'Something else',
    hint: 'The issue does not fit the categories above',
  },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  /** The account being reported. */
  account: MastodonAccount;
  /** Attached as evidence when the report starts from a post. */
  post?: MastodonPost;
}

export default function ReportModal({ visible, onClose, account, post }: ReportModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<ReportCategory>('other');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [forward, setForward] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [instanceConfig, setInstanceConfig] = useState<MastodonInstanceConfig>(
    DEFAULT_INSTANCE_CONFIG
  );

  // Server rules are needed to report a violation against a specific one.
  React.useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    getInstanceConfig()
      .then(config => {
        if (!cancelled) setInstanceConfig(config);
      })
      .catch(() => {
        // Falls back to defaults, which simply offers no rule list.
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // `acct` carries a domain only for accounts that live elsewhere, and
  // forwarding is meaningless for local ones.
  const remoteDomain = account.acct.includes('@') ? account.acct.split('@')[1] : null;
  const rules = instanceConfig.rules;

  const reset = () => {
    setCategory('other');
    setSelectedRuleIds([]);
    setComment('');
    setForward(false);
    setError('');
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleRule = (ruleId: string) => {
    setSelectedRuleIds(prev =>
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]
    );
  };

  const commentLength = [...comment].length;
  const commentTooLong = commentLength > REPORT_COMMENT_MAX_LENGTH;
  const needsRule = category === 'violation' && rules.length > 0 && selectedRuleIds.length === 0;
  const canSubmit = !submitting && !commentTooLong && !needsRule;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    try {
      await createReport({
        accountId: account.id,
        statusIds: post ? [post.id] : undefined,
        comment,
        forward: !!remoteDomain && forward,
        category,
        ruleIds: selectedRuleIds,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Could not send the report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : 0,
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={submitted ? 'Done' : 'Cancel'}
            accessibilityHint={
              submitted ? 'Double tap to close' : 'Double tap to close without reporting'
            }
          >
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {submitted ? 'Report sent' : 'Report'}
          </Text>
          {submitted ? (
            <View style={styles.headerSpacer} />
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[
                styles.submitButton,
                { backgroundColor: theme.error },
                !canSubmit && styles.submitButtonDisabled,
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Send report"
              accessibilityHint="Double tap to send this report to the moderators"
              accessibilityState={{ disabled: !canSubmit }}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {submitted ? (
          <View style={styles.confirmation}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={theme.success}
              accessible={false}
            />
            <Text
              style={[styles.confirmationTitle, { color: theme.text }]}
              accessibilityRole="header"
            >
              Thanks for letting us know
            </Text>
            <Text style={[styles.confirmationBody, { color: theme.textSecondary }]}>
              {remoteDomain && forward
                ? `Your report was sent to the moderators here and to ${remoteDomain}. They will review it.`
                : 'Your report was sent to the moderators. They will review it.'}
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              onPress={handleClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.target, { color: theme.textSecondary }]}>
              {post
                ? `Reporting a post by @${account.acct}`
                : `Reporting @${account.acct}`}
            </Text>

            <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
              What is wrong with it?
            </Text>

            {CATEGORIES.map(option => {
              const selected = category === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionRow, { borderColor: selected ? theme.primary : theme.border }]}
                  onPress={() => setCategory(option.value)}
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
                    <Text
                      style={[styles.optionHint, { color: theme.textSecondary }]}
                      accessible={false}
                    >
                      {option.hint}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {category === 'violation' && (
              <View style={styles.rulesSection}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text }]}
                  accessibilityRole="header"
                >
                  Which rules does it break?
                </Text>

                {rules.length === 0 ? (
                  <Text style={[styles.emptyRules, { color: theme.textSecondary }]}>
                    This server has not published any rules, so the report will be sent without one.
                  </Text>
                ) : (
                  rules.map(rule => {
                    const checked = selectedRuleIds.includes(rule.id);
                    return (
                      <TouchableOpacity
                        key={rule.id}
                        style={[
                          styles.optionRow,
                          { borderColor: checked ? theme.primary : theme.border },
                        ]}
                        onPress={() => toggleRule(rule.id)}
                        accessible={true}
                        accessibilityRole="checkbox"
                        accessibilityLabel={rule.text}
                        accessibilityHint={rule.hint}
                        accessibilityState={{ checked }}
                      >
                        <IconSymbol
                          ios_icon_name={checked ? 'checkmark.square.fill' : 'square'}
                          android_material_icon_name={
                            checked ? 'check-box' : 'check-box-outline-blank'
                          }
                          size={22}
                          color={checked ? theme.primary : theme.textSecondary}
                          accessible={false}
                        />
                        <View style={styles.optionText}>
                          <Text style={[styles.optionLabel, { color: theme.text }]} accessible={false}>
                            {rule.text}
                          </Text>
                          {rule.hint ? (
                            <Text
                              style={[styles.optionHint, { color: theme.textSecondary }]}
                              accessible={false}
                            >
                              {rule.hint}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
              Anything else we should know?
            </Text>
            <TextInput
              style={[
                styles.commentInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
              placeholder="Optional. Add any context that would help the moderators."
              placeholderTextColor={theme.textSecondary}
              multiline
              value={comment}
              onChangeText={setComment}
              accessible={true}
              accessibilityLabel="Additional comments"
              accessibilityHint="Optional context for the moderators"
            />
            <Text
              style={[
                styles.commentCount,
                { color: commentTooLong ? theme.error : theme.textSecondary },
              ]}
              accessible={true}
              accessibilityLabel={
                commentTooLong
                  ? `${commentLength - REPORT_COMMENT_MAX_LENGTH} characters over the limit`
                  : `${REPORT_COMMENT_MAX_LENGTH - commentLength} characters remaining`
              }
            >
              {REPORT_COMMENT_MAX_LENGTH - commentLength}
            </Text>

            {remoteDomain && (
              <TouchableOpacity
                style={[styles.forwardRow, { borderColor: theme.border }]}
                onPress={() => setForward(v => !v)}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel={`Also send to ${remoteDomain}`}
                accessibilityHint={`This account is on ${remoteDomain}. Moderators here cannot suspend it, but its own server can.`}
                accessibilityState={{ checked: forward }}
              >
                <IconSymbol
                  ios_icon_name={forward ? 'checkmark.square.fill' : 'square'}
                  android_material_icon_name={forward ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={forward ? theme.primary : theme.textSecondary}
                  accessible={false}
                />
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: theme.text }]} accessible={false}>
                    Also send to {remoteDomain}
                  </Text>
                  <Text
                    style={[styles.optionHint, { color: theme.textSecondary }]}
                    accessible={false}
                  >
                    This account is on another server. Moderators here can hide it, but only{' '}
                    {remoteDomain} can suspend it.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {needsRule && (
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                Choose at least one rule, or pick a different category.
              </Text>
            )}

            {error ? (
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    gap: 10,
  },
  target: {
    fontSize: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  rulesSection: {
    gap: 10,
  },
  emptyRules: {
    fontSize: 14,
    lineHeight: 19,
  },
  commentInput: {
    fontSize: 16,
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
  },
  commentCount: {
    fontSize: 13,
    textAlign: 'right',
  },
  forwardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 19,
  },
  confirmation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 10,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
