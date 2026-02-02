
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/styles/commonStyles';
import { registerApp, exchangeCode, normalizeInstanceUrl } from '@/lib/mastodon';
import { IconSymbol } from '@/components/IconSymbol';

const PENDING_INSTANCE_KEY = 'pending_mastodon_instance';

export default function ConnectMastodonScreen() {
  const router = useRouter();
  const [instanceUrl, setInstanceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const colorScheme = useColorScheme();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? colors.backgroundDark : colors.backgroundLight;
  const textColor = isDark ? colors.textDark : colors.textLight;
  const labelColor = isDark ? '#ffffff' : '#000000';
  const descriptionColor = isDark ? '#e5e5e7' : '#3c3c43';

  // Setup deep link listener
  useEffect(() => {
    console.log('ConnectMastodonScreen mounted, setting up deep link listener');
    
    // Check for initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL detected:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      console.log('Removing deep link listener');
      subscription.remove();
    };
  }, []);

  const handleDeepLink = React.useCallback(async ({ url }: { url: string }) => {
    console.log('Deep link received:', url);
    
    if (url.includes('mastodon-callback')) {
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.code as string;

      console.log('OAuth callback received with code:', code ? 'present' : 'missing');

      // Retrieve the pending instance URL from secure storage
      let storedInstanceUrl: string | null = null;
      if (Platform.OS === 'web') {
        storedInstanceUrl = localStorage.getItem(PENDING_INSTANCE_KEY);
      } else {
        storedInstanceUrl = await SecureStore.getItemAsync(PENDING_INSTANCE_KEY);
      }

      console.log('Using pending instance URL from storage:', storedInstanceUrl);

      if (code && storedInstanceUrl) {
        setLoading(true);
        await completeOAuthFlow(storedInstanceUrl, code);
      } else if (code && !storedInstanceUrl) {
        console.error('Code received but no pending instance URL in storage');
        setErrorMessage('Authentication failed: Missing instance information. Please try again.');
        setErrorModalVisible(true);
        setLoading(false);
      } else {
        console.error('Missing code in callback');
        setErrorMessage('Authentication failed: Missing authorization code');
        setErrorModalVisible(true);
        setLoading(false);
      }
    }
  }, []);

  const handleConnect = async () => {
    if (!instanceUrl.trim()) {
      setErrorMessage('Please enter your Mastodon instance URL');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    console.log('User tapped Connect button with instance:', instanceUrl);

    try {
      const normalizedUrl = normalizeInstanceUrl(instanceUrl);

      // Store the instance URL in secure storage so it persists across the OAuth flow
      if (Platform.OS === 'web') {
        localStorage.setItem(PENDING_INSTANCE_KEY, normalizedUrl);
      } else {
        await SecureStore.setItemAsync(PENDING_INSTANCE_KEY, normalizedUrl);
      }
      console.log('Stored pending instance URL in secure storage:', normalizedUrl);
      console.log('Registering app with Mastodon instance:', normalizedUrl);

      // Step 1: Register app directly with Mastodon instance
      const registerResponse = await registerApp(normalizedUrl);

      console.log('App registered successfully, opening authorization URL');
      console.log('Authorize URL:', registerResponse.authUrl);

      // Validate that we have a valid URL before opening the browser
      if (!registerResponse.authUrl) {
        throw new Error('Failed to get authorization URL');
      }

      // Step 2: Open Mastodon authorization URL in browser
      const redirectUri = Linking.createURL('mastodon-callback');
      console.log('Redirect URI:', redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(
        registerResponse.authUrl,
        redirectUri
      );

      console.log('WebBrowser result:', result);

      if (result.type === 'cancel') {
        console.log('User cancelled OAuth flow');
        setLoading(false);
        // Clear the pending instance URL from storage
        if (Platform.OS === 'web') {
          localStorage.removeItem(PENDING_INSTANCE_KEY);
        } else {
          await SecureStore.deleteItemAsync(PENDING_INSTANCE_KEY);
        }
      } else if (result.type === 'success' && result.url) {
        // Handle the callback URL directly if returned
        console.log('WebBrowser returned success with URL:', result.url);
        await handleDeepLink({ url: result.url });
      }
    } catch (error: any) {
      console.error('Failed to connect to Mastodon:', error);
      setErrorMessage(error.message || 'Failed to connect to Mastodon instance');
      setErrorModalVisible(true);
      setLoading(false);
      // Clear the pending instance URL from storage on error
      if (Platform.OS === 'web') {
        localStorage.removeItem(PENDING_INSTANCE_KEY);
      } else {
        await SecureStore.deleteItemAsync(PENDING_INSTANCE_KEY);
      }
    }
  };

  const completeOAuthFlow = React.useCallback(async (instanceUrl: string, code: string) => {
    try {
      console.log('Completing OAuth flow with code');

      // Step 3: Exchange authorization code for access token directly with Mastodon
      const response = await exchangeCode(instanceUrl, code);

      console.log('[OAuth] Authentication complete for:', response.account.username);

      // Clear pending instance URL from storage
      if (Platform.OS === 'web') {
        localStorage.removeItem(PENDING_INSTANCE_KEY);
      } else {
        await SecureStore.deleteItemAsync(PENDING_INSTANCE_KEY);
      }
      console.log('Cleared pending instance URL from storage');

      setLoading(false);

      // Navigate to home screen
      console.log('Navigating to home screen');
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.error('Failed to complete OAuth flow:', error);
      setErrorMessage(error.message || 'Failed to complete authentication');
      setErrorModalVisible(true);
      setLoading(false);
      // Clear pending instance URL from storage on error
      if (Platform.OS === 'web') {
        localStorage.removeItem(PENDING_INSTANCE_KEY);
      } else {
        await SecureStore.deleteItemAsync(PENDING_INSTANCE_KEY);
      }
    }
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Connect Mastodon',
          headerShown: true,
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <IconSymbol
            ios_icon_name="link.circle.fill"
            android_material_icon_name="link"
            size={80}
            color={colors.primary}
            style={{ marginBottom: 24 }}
          />

          <Text style={[styles.title, { color: textColor }]}>
            Connect to Mastodon
          </Text>

          <Text style={[styles.description, { color: descriptionColor }]}>
            Enter your Mastodon instance URL to get started.
          </Text>

          <Text style={[styles.label, { color: labelColor }]}>
            Instance URL
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                color: textColor,
                borderColor: isDark ? '#38383a' : '#c6c6c8',
              },
            ]}
            placeholder="mastodon.social"
            placeholderTextColor={isDark ? '#8e8e93' : '#999'}
            value={instanceUrl}
            onChangeText={setInstanceUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
            accessibilityLabel="Mastodon instance URL input"
            accessibilityHint="Enter the URL of your Mastodon instance, for example mastodon.social"
          />

          <Text style={[styles.hint, { color: isDark ? '#8e8e93' : '#666' }]}>
            Examples: mastodon.social, mastodon.online, fosstodon.org
          </Text>

          <TouchableOpacity
            style={[
              styles.connectButton,
              loading && styles.connectButtonDisabled,
            ]}
            onPress={handleConnect}
            disabled={loading}
            accessibilityLabel="Connect to Mastodon"
            accessibilityHint="Tap to connect to your Mastodon instance"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.infoText, { color: descriptionColor }]}>
              You&apos;ll be redirected to your instance to log in with your Mastodon credentials.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: bgColor }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color="#ff3b30"
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: textColor }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: textColor }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  connectButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 10,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
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
