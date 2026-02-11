
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { uploadMedia } from '@/lib/mastodon';
import { MastodonMediaAttachment } from '@/types/mastodon';
import AudioRecorder from '@/components/AudioRecorder';

interface ComposeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string, mediaIds?: string[]) => Promise<void>;
  replyToId?: string;
  replyToUsername?: string;
}

export default function ComposeModal({ visible, onClose, onSubmit, replyToId, replyToUsername }: ComposeModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<MastodonMediaAttachment[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [audioRecorderVisible, setAudioRecorderVisible] = useState(false);

  // Pre-fill with @username when replying
  React.useEffect(() => {
    if (visible && replyToUsername && replyToId) {
      setContent(`@${replyToUsername} `);
    } else if (visible && !replyToId) {
      setContent('');
    }
  }, [visible, replyToUsername, replyToId]);

  const handleSubmit = async () => {
    if (!content.trim() && mediaAttachments.length === 0) {
      setError('Please enter some content or attach media');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const mediaIds = mediaAttachments.length > 0
        ? mediaAttachments.map(m => m.id)
        : undefined;
      await onSubmit(content, mediaIds);
      setContent('');
      setError('');
      setMediaAttachments([]);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent('');
    setError('');
    setMediaAttachments([]);
    onClose();
  };

  const handlePickImage = async () => {
    if (mediaAttachments.length >= 4) {
      setError('Maximum 4 attachments allowed');
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
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handlePickAudioFile = async () => {
    if (mediaAttachments.length >= 4) {
      setError('Maximum 4 attachments allowed');
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
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload audio');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAudioRecorded = async (uri: string) => {
    setAudioRecorderVisible(false);
    if (mediaAttachments.length >= 4) {
      setError('Maximum 4 attachments allowed');
      return;
    }

    try {
      setUploadingMedia(true);
      setError('');
      const attachment = await uploadMedia(uri, 'audio/m4a');
      setMediaAttachments(prev => [...prev, attachment]);
    } catch (error: any) {
      setError(error.message || 'Failed to upload recording');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeAttachment = (index: number) => {
    setMediaAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const characterCount = content.length;
  const maxCharacters = 500;
  const isOverLimit = characterCount > maxCharacters;
  const canSubmit = (content.trim() || mediaAttachments.length > 0) && !isOverLimit && !loading && !uploadingMedia;

  const title = replyToId ? `Reply to @${replyToUsername}` : 'New Post';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme.background }]}
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
            accessibilityLabel="Post"
            accessibilityHint="Double tap to publish your post"
            accessibilityState={{ disabled: !canSubmit }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="What's on your mind?"
            placeholderTextColor={theme.textSecondary}
            multiline
            value={content}
            onChangeText={setContent}
            autoFocus
            accessible={true}
            accessibilityLabel="Post content"
            accessibilityHint="Enter the text for your post"
          />

          {/* Media thumbnails */}
          {(mediaAttachments.length > 0 || uploadingMedia) && (
            <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
              {mediaAttachments.map((attachment, index) => (
                <View key={attachment.id} style={styles.mediaThumbnailContainer}>
                  {attachment.type === 'audio' ? (
                    <View style={[styles.audioThumbnail, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <IconSymbol
                        ios_icon_name="waveform"
                        android_material_icon_name="audiotrack"
                        size={32}
                        color={theme.textSecondary}
                      />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: attachment.previewUrl || attachment.url }}
                      style={styles.mediaThumbnail}
                    />
                  )}
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
                    />
                  </TouchableOpacity>
                </View>
              ))}
              {uploadingMedia && (
                <View style={[styles.mediaThumbnailContainer, styles.uploadingThumbnail, { borderColor: theme.border }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              )}
            </ScrollView>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.footerLeft}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploadingMedia || mediaAttachments.length >= 4}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add media"
              accessibilityHint="Double tap to attach images or videos"
              style={mediaAttachments.length >= 4 ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={24}
                color={mediaAttachments.length >= 4 ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAudioRecorderVisible(true)}
              disabled={uploadingMedia || mediaAttachments.length >= 4}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Record audio"
              accessibilityHint="Double tap to record audio"
              style={mediaAttachments.length >= 4 ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="mic"
                android_material_icon_name="mic"
                size={24}
                color={mediaAttachments.length >= 4 ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickAudioFile}
              disabled={uploadingMedia || mediaAttachments.length >= 4}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Attach audio file"
              accessibilityHint="Double tap to pick an audio file"
              style={mediaAttachments.length >= 4 ? styles.disabledButton : undefined}
            >
              <IconSymbol
                ios_icon_name="music.note"
                android_material_icon_name="music-note"
                size={24}
                color={mediaAttachments.length >= 4 ? theme.border : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.characterCount,
              { color: isOverLimit ? theme.error : theme.textSecondary },
            ]}
            accessible={true}
            accessibilityLabel={`${characterCount} of ${maxCharacters} characters`}
          >
            {characterCount}/{maxCharacters}
          </Text>
        </View>
      </KeyboardAvoidingView>

      <AudioRecorder
        visible={audioRecorderVisible}
        onClose={() => setAudioRecorderVisible(false)}
        onRecordingComplete={handleAudioRecorded}
      />
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
  input: {
    flex: 1,
    fontSize: 18,
    textAlignVertical: 'top',
  },
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
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
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
