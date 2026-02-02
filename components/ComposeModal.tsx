
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
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface ComposeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
  replyToId?: string;
  replyToUsername?: string;
}

export default function ComposeModal({ visible, onClose, onSubmit, replyToId, replyToUsername }: ComposeModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill with @username when replying
  React.useEffect(() => {
    if (visible && replyToUsername && replyToId) {
      setContent(`@${replyToUsername} `);
    } else if (visible && !replyToId) {
      setContent('');
    }
  }, [visible, replyToUsername, replyToId]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      console.log('User attempted to submit empty post');
      setError('Please enter some content');
      return;
    }

    console.log('User submitting post:', content, replyToId ? `as reply to ${replyToId}` : '');
    setLoading(true);
    setError('');
    try {
      await onSubmit(content);
      setContent('');
      setError('');
      onClose();
    } catch (error: any) {
      console.error('Error submitting post:', error);
      setError(error.message || 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    console.log('User closed compose modal');
    setContent('');
    setError('');
    onClose();
  };

  const characterCount = content.length;
  const maxCharacters = 500;
  const isOverLimit = characterCount > maxCharacters;

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
            disabled={loading || !content.trim() || isOverLimit}
            style={[
              styles.postButton,
              { backgroundColor: theme.primary },
              (loading || !content.trim() || isOverLimit) && styles.postButtonDisabled,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Post"
            accessibilityHint="Double tap to publish your post"
            accessibilityState={{ disabled: loading || !content.trim() || isOverLimit }}
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
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add media"
              accessibilityHint="Double tap to attach images or videos"
            >
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={24}
                color={theme.textSecondary}
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
