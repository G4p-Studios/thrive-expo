
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
  Image,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  uploadMedia,
  updateMediaDescription,
  buildReplyMentions,
  formatMentionPrefix,
  getReplyTarget,
  getAccountCache,
  getInstanceConfig,
  DEFAULT_INSTANCE_CONFIG,
  countStatusCharacters,
  generateIdempotencyKey,
  getStatusSource,
  getPreferences,
  stripHtml,
  joinSpokenParts,
} from '@/lib/mastodon';
import type { PostVisibility } from '@/lib/mastodon';
import {
  MastodonInstanceConfig,
  MastodonMediaAttachment,
  MastodonPost,
} from '@/types/mastodon';
import AudioRecorder from '@/components/AudioRecorder';
import { playInAppSound } from '@/lib/notifications';

/**
 * What a screen reader should say for the quoted post shown in the composer.
 *
 * It is read as one thing rather than three, because at this point it is a
 * fixed reference the writer is commenting on, not something they can edit.
 */
function buildQuotedPreviewLabel(quoted: MastodonPost, name: string): string {
  const spoiler = quoted.spoilerText?.trim();
  return joinSpokenParts([
    `Quoting ${name}, @${quoted.account.acct}`,
    // Quoting somebody does not lift the warning they put on their own post.
    spoiler ? `Content warning: ${spoiler}` : stripHtml(quoted.content ?? ''),
  ]);
}

/** Everything the composer collects alongside the post body. */
export interface ComposeSubmission {
  mediaIds?: string[];
  /**
   * Always a string, never undefined, so an edit that clears a content warning
   * actually removes it. `createPost` ignores an empty value.
   */
  spoilerText?: string;
  sensitive?: boolean;
  visibility?: PostVisibility;
  /** Stable across retries of the same post; see `generateIdempotencyKey`. */
  idempotencyKey?: string;
  /** The post being quoted, when the composer was opened to quote one. */
  quotedStatusId?: string;
}

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  hint: string;
  ios: string;
  android: 'public' | 'lock-open' | 'lock' | 'alternate-email';
}[] = [
  { value: 'public', label: 'Public', hint: 'Visible to anyone and listed in public timelines', ios: 'globe', android: 'public' },
  { value: 'unlisted', label: 'Quiet public', hint: 'Visible to anyone but kept out of public timelines', ios: 'moon', android: 'lock-open' },
  { value: 'private', label: 'Followers', hint: 'Visible only to your followers', ios: 'lock', android: 'lock' },
  { value: 'direct', label: 'Mentioned only', hint: 'Visible only to the people you mention', ios: 'at', android: 'alternate-email' },
];

interface ComposeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string, submission: ComposeSubmission) => Promise<void>;
  /** The post being replied to, if any. Boosts are unwrapped automatically. */
  replyToPost?: MastodonPost;
  /** When set, the composer edits this post instead of creating a new one. */
  editingPost?: MastodonPost;
  /**
   * When set, the new post quotes this one. Unlike a reply, a quote adds no
   * mentions and does not inherit the quoted post's audience — quoting is a
   * public act of commentary, not a private answer.
   */
  quotingPost?: MastodonPost;
  /**
   * Audience for a brand new post. A reply always inherits the audience of the
   * post it answers, so this only applies when there is nothing to inherit.
   */
  initialVisibility?: PostVisibility;
}

export default function ComposeModal({
  visible,
  onClose,
  onSubmit,
  replyToPost,
  editingPost,
  quotingPost,
  initialVisibility,
}: ComposeModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<MastodonMediaAttachment[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [audioRecorderVisible, setAudioRecorderVisible] = useState(false);

  // Content warning
  const [cwEnabled, setCwEnabled] = useState(false);
  const [spoilerText, setSpoilerText] = useState('');
  const [markSensitive, setMarkSensitive] = useState(false);

  // Alt text editor: index of the attachment being described, or null.
  const [altTargetIndex, setAltTargetIndex] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);
  const [altError, setAltError] = useState('');

  // Audience
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [visibilityPickerOpen, setVisibilityPickerOpen] = useState(false);

  // Editing
  const [loadingSource, setLoadingSource] = useState(false);
  // Attachments that were already on the post being edited. Their descriptions
  // can no longer be changed through the media endpoint.
  const [originalMediaIds, setOriginalMediaIds] = useState<string[]>([]);

  /**
   * Held across retries so a re-tap after a dropped response doesn't post
   * twice, and cleared once a post lands.
   */
  const idempotencyKeyRef = React.useRef<string | null>(null);

  /**
   * Drop the key whenever the post changes.
   *
   * Reusing a key after an edit would make the server return the *original*
   * status and quietly throw the edit away, so only an unchanged retry should
   * be deduplicated.
   */
  const invalidateIdempotencyKey = () => {
    idempotencyKeyRef.current = null;
  };

  const handleContentChange = (text: string) => {
    invalidateIdempotencyKey();
    setContent(text);
  };

  const handleSpoilerChange = (text: string) => {
    invalidateIdempotencyKey();
    setSpoilerText(text);
  };

  // Posting limits come from the server; these are only the starting point.
  const [instanceConfig, setInstanceConfig] = useState<MastodonInstanceConfig>(
    DEFAULT_INSTANCE_CONFIG
  );

  const insets = useSafeAreaInsets();

  // The instance decides how long a post may be and how much media it takes.
  React.useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    getInstanceConfig()
      .then((config) => {
        if (!cancelled) setInstanceConfig(config);
      })
      .catch(() => {
        // getInstanceConfig already falls back to defaults; nothing to do.
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Declared ahead of the handlers that close over it.
  const maxAttachments = instanceConfig.maxMediaAttachments;

  // The account's own posting defaults, set in the server's web preferences.
  // Ignoring these would post publicly for someone who defaults to followers.
  React.useEffect(() => {
    if (!visible) return;
    // An explicit prop, a reply, or an edit all decide the audience themselves.
    if (initialVisibility || replyToPost || editingPost) return;

    let cancelled = false;

    getPreferences()
      .then(preferences => {
        if (cancelled) return;
        setVisibility(preferences.defaultVisibility);
        if (preferences.defaultSensitive) setMarkSensitive(true);
      })
      .catch(() => {
        // Older servers may not expose preferences; the default stands.
      });

    return () => {
      cancelled = true;
    };
  }, [visible, initialVisibility, replyToPost, editingPost]);

  // Pre-fill the reply with the full handles of everyone in the thread.
  React.useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    (async () => {
      // Editing: load the markup the author actually typed. The status entity
      // only carries rendered HTML, which would put tags in the editor.
      if (editingPost) {
        setLoadingSource(true);
        setMediaAttachments(editingPost.mediaAttachments || []);
        setOriginalMediaIds((editingPost.mediaAttachments || []).map(m => m.id));
        setMarkSensitive(!!editingPost.sensitive);

        try {
          const source = await getStatusSource(editingPost.id);
          if (cancelled) return;

          setContent(source.text);
          if (source.spoilerText) {
            setCwEnabled(true);
            setSpoilerText(source.spoilerText);
          }
        } catch (error: any) {
          if (!cancelled) setError(error.message || 'Could not load the post for editing');
        } finally {
          if (!cancelled) setLoadingSource(false);
        }
        return;
      }

      if (!replyToPost) {
        if (!cancelled) {
          setContent('');
          if (initialVisibility) setVisibility(initialVisibility);
        }
        return;
      }

      const target = getReplyTarget(replyToPost);

      // Replies default to the audience of the post they answer, so a private
      // thread doesn't accidentally get a public reply.
      if (target.visibility) {
        setVisibility(target.visibility as PostVisibility);
      }

      // Our own handle is dropped from the prefill; read it from the cache the
      // OAuth flow populates so opening the composer stays offline-fast.
      const self = await getAccountCache();
      if (cancelled) return;

      const handles = buildReplyMentions(replyToPost, self?.acct || self?.username);
      setContent(formatMentionPrefix(handles));

      // Carry the warning into the reply so answering a post doesn't strip the
      // context the original author put on it.
      const inheritedWarning = target.spoilerText?.trim();
      if (inheritedWarning) {
        setCwEnabled(true);
        setSpoilerText(inheritedWarning);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, replyToPost, editingPost, initialVisibility]);

  const resetComposer = () => {
    setContent('');
    setError('');
    setMediaAttachments([]);
    setCwEnabled(false);
    setSpoilerText('');
    setMarkSensitive(false);
    setAltTargetIndex(null);
    setAltDraft('');
    setAltError('');
    setVisibility('public');
    setVisibilityPickerOpen(false);
    setOriginalMediaIds([]);
    idempotencyKeyRef.current = null;
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaAttachments.length === 0) {
      setError('Please enter some content or attach media');
      return;
    }

    const trimmedSpoiler = cwEnabled ? spoilerText.trim() : '';
    if (cwEnabled && !trimmedSpoiler) {
      setError('Add a content warning or turn it off');
      return;
    }

    // Generated once and reused, so re-tapping Post after a timeout resolves to
    // the same status server-side instead of creating a second one.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }

    setLoading(true);
    setError('');
    try {
      const mediaIds = mediaAttachments.length > 0
        ? mediaAttachments.map(m => m.id)
        : undefined;

      await onSubmit(content, {
        mediaIds,
        // Always a string: an edit that empties this must clear the warning.
        spoilerText: trimmedSpoiler,
        // A content warning always implies sensitive, which is what the web UI
        // does; the toggle covers media that needs hiding without a warning.
        sensitive: !!trimmedSpoiler || (markSensitive && mediaAttachments.length > 0),
        // Mastodon does not allow changing a post's audience after the fact.
        visibility: editingPost ? undefined : visibility,
        idempotencyKey: idempotencyKeyRef.current,
        // A quote cannot be added to a post after the fact, so this is only
        // ever sent when creating one.
        quotedStatusId: editingPost ? undefined : quotingPost?.id,
      });

      playInAppSound(replyToPost ? 'sendReply' : 'sendPost');
      resetComposer();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetComposer();
    onClose();
  };

  const openAltEditor = (index: number) => {
    const attachment = mediaAttachments[index];

    // The media endpoint only accepts descriptions while an attachment is
    // unattached, so say so rather than letting the save fail.
    if (attachment && originalMediaIds.includes(attachment.id)) {
      setError('Descriptions cannot be changed once a post is published.');
      return;
    }

    setAltTargetIndex(index);
    setAltDraft(attachment?.description || '');
    setAltError('');
  };

  const handleSaveAltText = async () => {
    if (altTargetIndex === null) return;

    const attachment = mediaAttachments[altTargetIndex];
    if (!attachment) return;

    const description = altDraft.trim();
    setSavingAlt(true);
    setAltError('');
    try {
      const updated = await updateMediaDescription(attachment.id, description);
      setMediaAttachments(prev =>
        prev.map((item, i) =>
          i === altTargetIndex ? { ...item, description: updated.description ?? description } : item
        )
      );
      setAltTargetIndex(null);
      setAltDraft('');
    } catch (error: any) {
      setAltError(error.message || 'Could not save the description. Try again.');
    } finally {
      setSavingAlt(false);
    }
  };

  const handlePickImage = async () => {
    if (mediaAttachments.length >= maxAttachments) {
      setError(`You can attach up to ${maxAttachments} ${maxAttachments === 1 ? 'file' : 'files'}`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

      setUploadingMedia(true);
      setError('');
      const attachment = await uploadMedia(asset.uri, mimeType);
      invalidateIdempotencyKey();
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handlePickAudioFile = async () => {
    if (mediaAttachments.length >= maxAttachments) {
      setError(`You can attach up to ${maxAttachments} ${maxAttachments === 1 ? 'file' : 'files'}`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'audio/mpeg';

      setUploadingMedia(true);
      setError('');
      const attachment = await uploadMedia(asset.uri, mimeType);
      invalidateIdempotencyKey();
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload audio');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAudioRecorded = async (uri: string) => {
    setAudioRecorderVisible(false);
    if (mediaAttachments.length >= maxAttachments) {
      setError(`You can attach up to ${maxAttachments} ${maxAttachments === 1 ? 'file' : 'files'}`);
      return;
    }

    try {
      setUploadingMedia(true);
      setError('');
      const attachment = await uploadMedia(uri, 'audio/m4a');
      invalidateIdempotencyKey();
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload recording');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeAttachment = (index: number) => {
    invalidateIdempotencyKey();
    setMediaAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Counted the way the server counts: URLs are flattened to a fixed width,
  // remote mention domains are free, and the content warning shares the budget.
  const maxCharacters = instanceConfig.maxCharacters;
  const characterCount = countStatusCharacters(content, {
    spoilerText: cwEnabled ? spoilerText : '',
    charactersReservedPerUrl: instanceConfig.charactersReservedPerUrl,
  });
  const charactersRemaining = maxCharacters - characterCount;
  const isOverLimit = charactersRemaining < 0;

  const atAttachmentLimit = mediaAttachments.length >= maxAttachments;
  const missingAltText = mediaAttachments.filter(m => !m.description?.trim()).length;

  const canSubmit =
    (content.trim() || mediaAttachments.length > 0) &&
    !isOverLimit &&
    !loading &&
    !uploadingMedia &&
    !loadingSource;

  const quotedName =
    quotingPost?.account.displayName?.trim() || quotingPost?.account.username || '';

  const title = quotingPost
    ? `Quote @${quotingPost.account.acct}`
    : editingPost
    ? 'Edit post'
    : replyToPost
      ? `Reply to @${getReplyTarget(replyToPost).account.acct}`
      : 'New Post';

  const submitLabel = editingPost ? 'Save' : 'Post';
  const activeVisibility =
    VISIBILITY_OPTIONS.find(o => o.value === visibility) ?? VISIBILITY_OPTIONS[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : 0 }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Double tap to close compose window"
          >
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[
              styles.postButton,
              { backgroundColor: theme.primary },
              !canSubmit && styles.postButtonDisabled,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityHint={
              editingPost
                ? 'Double tap to save your changes'
                : 'Double tap to publish your post'
            }
            accessibilityState={{ disabled: !canSubmit }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {loadingSource && (
            <View style={styles.sourceLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.sourceLoadingText, { color: theme.textSecondary }]}>
                Loading your post…
              </Text>
            </View>
          )}

          {cwEnabled && (
            <TextInput
              style={[
                styles.spoilerInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
              placeholder="Content warning"
              placeholderTextColor={theme.textSecondary}
              value={spoilerText}
              onChangeText={handleSpoilerChange}
              autoFocus
              accessible={true}
              accessibilityLabel="Content warning"
              accessibilityHint="Describe what the post contains. This is shown before the post is revealed."
            />
          )}

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={quotingPost ? 'Add a comment' : "What's on your mind?"}
            placeholderTextColor={theme.textSecondary}
            multiline
            value={content}
            onChangeText={handleContentChange}
            autoFocus={!cwEnabled}
            accessible={true}
            accessibilityLabel={quotingPost ? 'Your comment' : 'Post content'}
            accessibilityHint={
              quotingPost
                ? 'Enter what you want to say about the quoted post'
                : 'Enter the text for your post'
            }
          />

          {/* What is being quoted, shown below the box the way it will appear
              in the finished post. One accessibility element, because it is a
              single thing being referred to rather than controls. */}
          {quotingPost && (
            <View
              style={[styles.quoted, { borderColor: theme.border, backgroundColor: theme.card }]}
              accessible={true}
              accessibilityLabel={buildQuotedPreviewLabel(quotingPost, quotedName)}
            >
              <Text
                style={[styles.quotedAuthor, { color: theme.textSecondary }]}
                numberOfLines={1}
                accessible={false}
              >
                {quotedName} @{quotingPost.account.acct}
              </Text>
              {quotingPost.spoilerText?.trim() ? (
                <Text
                  style={[styles.quotedBody, { color: theme.textSecondary }]}
                  accessible={false}
                >
                  Content warning: {quotingPost.spoilerText.trim()}
                </Text>
              ) : (
                <Text
                  style={[styles.quotedBody, { color: theme.text }]}
                  numberOfLines={4}
                  accessible={false}
                >
                  {stripHtml(quotingPost.content ?? '')}
                </Text>
              )}
            </View>
          )}

          {/* Media thumbnails */}
          {(mediaAttachments.length > 0 || uploadingMedia) && (
            <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
              {mediaAttachments.map((attachment, index) => {
                const hasAlt = !!attachment.description?.trim();
                return (
                  <View key={attachment.id} style={styles.mediaThumbnailContainer}>
                    <TouchableOpacity
                      style={styles.mediaThumbnailPress}
                      onPress={() => openAltEditor(index)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={
                        hasAlt
                          ? `Attachment ${index + 1}, described: ${attachment.description}`
                          : `Attachment ${index + 1}, no description`
                      }
                      accessibilityHint={
                        hasAlt
                          ? 'Double tap to edit the description'
                          : 'Double tap to add a description for screen readers'
                      }
                    >
                      {attachment.type === 'audio' ? (
                        <View style={[styles.audioThumbnail, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <IconSymbol
                            ios_icon_name="waveform"
                            android_material_icon_name="audiotrack"
                            size={32}
                            color={theme.textSecondary}
                            accessible={false}
                          />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: attachment.previewUrl || attachment.url }}
                          style={styles.mediaThumbnail}
                          accessible={false}
                        />
                      )}
                      <View
                        style={[
                          styles.altBadge,
                          hasAlt
                            ? { backgroundColor: theme.primary }
                            : { backgroundColor: theme.error },
                        ]}
                        accessible={false}
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Text style={styles.altBadgeText}>{hasAlt ? 'ALT' : '+ALT'}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeAttachment(index)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove attachment ${index + 1}`}
                    >
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={22}
                        color="#FFFFFF"
                        accessible={false}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {uploadingMedia && (
                <View style={[styles.mediaThumbnailContainer, styles.uploadingThumbnail, { borderColor: theme.border }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              )}
            </ScrollView>
          )}

          {missingAltText > 0 && (
            <Text style={[styles.altHint, { color: theme.textSecondary }]}>
              {missingAltText === 1
                ? '1 attachment has no description. Tap it to add one.'
                : `${missingAltText} attachments have no description. Tap them to add one.`}
            </Text>
          )}

          {mediaAttachments.length > 0 && (
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setMarkSensitive(v => !v)}
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Mark media as sensitive"
              accessibilityHint="Hides the attachments behind a warning until someone taps to reveal them"
              accessibilityState={{ checked: markSensitive }}
            >
              <IconSymbol
                ios_icon_name={markSensitive ? 'checkmark.square.fill' : 'square'}
                android_material_icon_name={markSensitive ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={markSensitive ? theme.primary : theme.textSecondary}
                accessible={false}
              />
              <Text style={[styles.toggleLabel, { color: theme.text }]}>
                Mark media as sensitive
              </Text>
            </TouchableOpacity>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.footerLeft}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploadingMedia || atAttachmentLimit}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add media"
              accessibilityHint="Double tap to attach images or videos"
              style={atAttachmentLimit ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={24}
                color={atAttachmentLimit ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAudioRecorderVisible(true)}
              disabled={uploadingMedia || atAttachmentLimit}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Record audio"
              accessibilityHint="Double tap to record audio"
              style={atAttachmentLimit ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="mic"
                android_material_icon_name="mic"
                size={24}
                color={atAttachmentLimit ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickAudioFile}
              disabled={uploadingMedia || atAttachmentLimit}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Attach audio file"
              accessibilityHint="Double tap to pick an audio file"
              style={atAttachmentLimit ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="music.note"
                android_material_icon_name="music-note"
                size={24}
                color={atAttachmentLimit ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCwEnabled(v => !v)}
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Content warning"
              accessibilityHint="Double tap to add a warning shown before the post is revealed"
              accessibilityState={{ checked: cwEnabled }}
            >
              <IconSymbol
                ios_icon_name="exclamationmark.triangle"
                android_material_icon_name="warning"
                size={24}
                color={cwEnabled ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
            {/* A published post's audience is fixed, so this is hidden when editing. */}
            {!editingPost && (
              <TouchableOpacity
                onPress={() => setVisibilityPickerOpen(true)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Audience: ${activeVisibility.label}`}
                accessibilityHint="Double tap to choose who can see this post"
              >
                <IconSymbol
                  ios_icon_name={activeVisibility.ios}
                  android_material_icon_name={activeVisibility.android}
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={[
              styles.characterCount,
              { color: isOverLimit ? theme.error : theme.textSecondary },
            ]}
            accessible={true}
            accessibilityLabel={
              isOverLimit
                ? `${Math.abs(charactersRemaining)} characters over the limit of ${maxCharacters}`
                : `${charactersRemaining} characters remaining of ${maxCharacters}`
            }
          >
            {charactersRemaining}
          </Text>
        </View>
      </KeyboardAvoidingView>

      <AudioRecorder
        visible={audioRecorderVisible}
        onClose={() => setAudioRecorderVisible(false)}
        onRecordingComplete={handleAudioRecorded}
      />

      {/* Audience picker */}
      <Modal
        visible={visibilityPickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setVisibilityPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setVisibilityPickerOpen(false)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close audience picker"
        >
          <View
            style={[styles.pickerSheet, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Who can see this?</Text>
            {VISIBILITY_OPTIONS.map(option => {
              const selected = option.value === visibility;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.pickerRow}
                  onPress={() => {
                    setVisibility(option.value);
                    setVisibilityPickerOpen(false);
                  }}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint}
                  accessibilityState={{ selected }}
                >
                  <IconSymbol
                    ios_icon_name={option.ios}
                    android_material_icon_name={option.android}
                    size={22}
                    color={selected ? theme.primary : theme.textSecondary}
                    accessible={false}
                  />
                  <View style={styles.pickerRowText}>
                    <Text
                      style={[styles.pickerLabel, { color: selected ? theme.primary : theme.text }]}
                      accessible={false}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[styles.pickerHint, { color: theme.textSecondary }]}
                      accessible={false}
                    >
                      {option.hint}
                    </Text>
                  </View>
                  {selected && (
                    <IconSymbol
                      ios_icon_name="checkmark"
                      android_material_icon_name="check"
                      size={20}
                      color={theme.primary}
                      accessible={false}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Alt text editor */}
      <Modal
        visible={altTargetIndex !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAltTargetIndex(null)}
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
              onPress={() => setAltTargetIndex(null)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Double tap to discard this description"
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>Describe this</Text>
            <TouchableOpacity
              onPress={handleSaveAltText}
              disabled={savingAlt}
              style={[
                styles.postButton,
                { backgroundColor: theme.primary },
                savingAlt && styles.postButtonDisabled,
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save description"
              accessibilityState={{ disabled: savingAlt }}
            >
              {savingAlt ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.postButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.altExplainer, { color: theme.textSecondary }]}>
              Describe the attachment for people who use a screen reader or have images turned off.
            </Text>
            <TextInput
              style={[
                styles.altInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
              placeholder="For example: a tabby cat asleep on a keyboard"
              placeholderTextColor={theme.textSecondary}
              multiline
              value={altDraft}
              onChangeText={setAltDraft}
              autoFocus
              accessible={true}
              accessibilityLabel="Description"
              accessibilityHint="Enter a description of this attachment"
            />
            {altError ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: theme.error }]}>{altError}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentInner: {
    flexGrow: 1,
  },
  input: {
    flex: 1,
    fontSize: 18,
    textAlignVertical: 'top',
    minHeight: 120,
    maxHeight: 300,
  },
  quoted: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    gap: 4,
  },
  quotedAuthor: { fontSize: 13, fontWeight: '600' },
  quotedBody: { fontSize: 14, lineHeight: 20 },
  mediaPreview: {
    flexDirection: 'row',
    marginTop: 12,
    maxHeight: 80,
  },
  mediaThumbnailContainer: {
    width: 72,
    height: 72,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaThumbnailPress: {
    width: '100%',
    height: '100%',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  altBadge: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  altBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  altHint: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  altExplainer: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  altInput: {
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  spoilerInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
  },
  sourceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  sourceLoadingText: {
    fontSize: 14,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 4,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  pickerRowText: {
    flex: 1,
    gap: 2,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerHint: {
    fontSize: 13,
    lineHeight: 17,
  },
  audioThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingThumbnail: {
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 11,
  },
  disabledButton: {
    opacity: 0.4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  characterCount: {
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
