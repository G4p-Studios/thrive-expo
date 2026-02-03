
import React, { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
  TextInput,
  Switch,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { MastodonAccount } from '@/types/mastodon';
import { verifyCredentials, updateCredentials, UpdateCredentialsData } from '@/lib/mastodon';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [account, setAccount] = useState<MastodonAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'avatar' | 'header'>('avatar');

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [note, setNote] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [headerUri, setHeaderUri] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);
  const [bot, setBot] = useState(false);

  // Track if images were changed
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [headerChanged, setHeaderChanged] = useState(false);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('EditProfileScreen mounted, loading profile');
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log('Fetching profile for editing');
      const freshAccount = await verifyCredentials();
      setAccount(freshAccount);

      // Initialize form state
      setDisplayName(freshAccount.displayName || '');
      setNote(freshAccount.note ? freshAccount.note.replace(/<[^>]*>/g, '') : '');
      setAvatarUri(freshAccount.avatar || null);
      setHeaderUri(freshAccount.header || null);
      setLocked(freshAccount.locked || false);
      setDiscoverable(freshAccount.discoverable !== false); // Default to true
      setBot(freshAccount.bot || false);
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      setErrorMessage(error.message || 'Failed to load profile');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const showImagePicker = (target: 'avatar' | 'header') => {
    setImagePickerTarget(target);
    setImagePickerVisible(true);
  };

  const pickImageFromGallery = async () => {
    setImagePickerVisible(false);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setErrorMessage('Permission to access gallery is required');
      setErrorModalVisible(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: imagePickerTarget === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64Uri = `data:image/jpeg;base64,${asset.base64}`;

      if (imagePickerTarget === 'avatar') {
        setAvatarUri(asset.uri);
        setAvatarChanged(true);
      } else {
        setHeaderUri(asset.uri);
        setHeaderChanged(true);
      }
    }
  };

  const takePhoto = async () => {
    setImagePickerVisible(false);

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      setErrorMessage('Permission to access camera is required');
      setErrorModalVisible(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: imagePickerTarget === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      if (imagePickerTarget === 'avatar') {
        setAvatarUri(asset.uri);
        setAvatarChanged(true);
      } else {
        setHeaderUri(asset.uri);
        setHeaderChanged(true);
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      console.log('Saving profile changes');

      const data: UpdateCredentialsData = {
        displayName,
        note,
        locked,
        discoverable,
        bot,
      };

      // If avatar changed, we need to get the base64 data
      if (avatarChanged && avatarUri) {
        // Re-pick the image to get base64 if we don't have it
        // For now, we'll read from the URI
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        data.avatar = base64;
      }

      // If header changed, we need to get the base64 data
      if (headerChanged && headerUri) {
        const response = await fetch(headerUri);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        data.header = base64;
      }

      await updateCredentials(data);
      console.log('Profile saved successfully');

      // Navigate back
      router.back();
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      setErrorMessage(error.message || 'Failed to save profile');
      setErrorModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const headerRight = useCallback(() => (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving}
      style={styles.headerButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Save profile"
    >
      {saving ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : (
        <Text style={[styles.saveButtonText, { color: theme.primary }]}>Save</Text>
      )}
    </TouchableOpacity>
  ), [saving, theme.primary, handleSave]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Edit Profile',
            headerShown: true,
            headerBackTitle: 'Cancel',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerBackTitle: 'Cancel',
          headerRight,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Image */}
        <TouchableOpacity
          onPress={() => showImagePicker('header')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Change header image"
          accessibilityHint="Double tap to change your header image"
        >
          {headerUri ? (
            <Image
              source={resolveImageSource(headerUri)}
              style={styles.headerImage}
            />
          ) : (
            <View style={[styles.headerImage, { backgroundColor: theme.primary }]} />
          )}
          <View style={[styles.imageOverlay, styles.headerOverlay]}>
            <IconSymbol
              ios_icon_name="camera.fill"
              android_material_icon_name="photo-camera"
              size={24}
              color="#fff"
            />
            <Text style={styles.overlayText}>Change Header</Text>
          </View>
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={() => showImagePicker('avatar')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            accessibilityHint="Double tap to change your profile picture"
          >
            <Image
              source={resolveImageSource(avatarUri || '')}
              style={[styles.avatar, { borderColor: theme.background }]}
            />
            <View style={[styles.imageOverlay, styles.avatarOverlay]}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="photo-camera"
                size={20}
                color="#fff"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Display Name */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Display Name
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your display name"
              placeholderTextColor={theme.textSecondary}
              maxLength={30}
            />
          </View>

          {/* Bio */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Bio
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              value={note}
              onChangeText={setNote}
              placeholder="Tell people about yourself"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Toggles Section */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Account Settings
          </Text>

          {/* Locked Account */}
          <View style={[styles.toggleContainer, { borderColor: theme.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>
                Lock Account
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.textSecondary }]}>
                Manually approve follow requests
              </Text>
            </View>
            <Switch
              value={locked}
              onValueChange={setLocked}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Discoverable */}
          <View style={[styles.toggleContainer, { borderColor: theme.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>
                Discoverable
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.textSecondary }]}>
                Allow your account to be discovered
              </Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Bot */}
          <View style={[styles.toggleContainer, { borderColor: theme.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>
                Bot Account
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.textSecondary }]}>
                Mark this account as automated
              </Text>
            </View>
            <Switch
              value={bot}
              onValueChange={setBot}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={imagePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImagePickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Change {imagePickerTarget === 'avatar' ? 'Profile Picture' : 'Header Image'}
            </Text>

            <TouchableOpacity
              style={[styles.modalOption, { borderColor: theme.border }]}
              onPress={takePhoto}
            >
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="photo-camera"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.modalOptionText, { color: theme.text }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, { borderColor: theme.border }]}
              onPress={pickImageFromGallery}
            >
              <IconSymbol
                ios_icon_name="photo.on.rectangle"
                android_material_icon_name="photo-library"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.modalOptionText, { color: theme.text }]}>
                Choose from Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: theme.border }]}
              onPress={() => setImagePickerVisible(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color={theme.error}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
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
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerImage: {
    height: 150,
    width: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
  },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarContainer: {
    marginLeft: 16,
    marginTop: -50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  formSection: {
    padding: 16,
    marginTop: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancelButton: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
