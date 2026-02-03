
import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { MastodonAccount } from '@/types/mastodon';
import { verifyCredentials, clearAuth, getAccountCache, getInstanceUrl } from '@/lib/mastodon';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [account, setAccount] = useState<MastodonAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnectModalVisible, setDisconnectModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('ProfileScreen (Me tab) mounted, loading Mastodon account');
    loadMastodonAccount();
  }, []);

  const loadMastodonAccount = async () => {
    try {
      console.log('Fetching Mastodon account info');
      // First try to get cached account data
      const cachedAccount = await getAccountCache();
      if (cachedAccount) {
        const instanceUrl = await getInstanceUrl();
        setAccount({ ...cachedAccount, instanceUrl: instanceUrl || cachedAccount.instanceUrl });
        setLoading(false);
      }

      // Then verify credentials and update
      const freshAccount = await verifyCredentials();
      const instanceUrl = await getInstanceUrl();
      setAccount({ ...freshAccount, instanceUrl: instanceUrl || '' });
    } catch (error: any) {
      console.error('Failed to load Mastodon account:', error);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    console.log('User tapped Connect Mastodon button');
    router.push('/connect-mastodon');
  };

  const handleViewProfile = () => {
    console.log('User tapped profile area to view full profile');
    router.push('/profile-detail');
  };

  const handleDisconnectConfirm = () => {
    console.log('User tapped Disconnect button');
    setDisconnectModalVisible(true);
  };

  const handleDisconnect = async () => {
    setDisconnectModalVisible(false);
    setLoading(true);

    try {
      console.log('Disconnecting Mastodon account...');
      await clearAuth();
      console.log('Local auth data cleared');
    } catch (error: any) {
      console.error('Failed to clear auth data:', error);
    } finally {
      setAccount(null);
      setLoading(false);

      // Redirect to connect screen
      console.log('Redirecting to connect screen');
      router.replace('/connect-mastodon');
    }
  };

  const handleBookmarks = () => {
    console.log('User tapped Bookmarks menu item');
    router.push('/bookmarks');
  };

  const handleLists = () => {
    console.log('User tapped Lists menu item');
    router.push('/lists');
  };

  const handleSettings = () => {
    console.log('User tapped Settings menu item');
    router.push('/settings');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Me',
            headerShown: true,
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  if (!account) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Me',
            headerShown: true,
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileSection}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={100}
              color={theme.primary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: theme.text, marginBottom: 16 }]}>
              No Mastodon account connected
            </Text>
            <TouchableOpacity 
              style={[styles.connectButton, { backgroundColor: theme.primary }]} 
              onPress={handleConnect}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Connect Mastodon account"
              accessibilityHint="Double tap to connect your Mastodon account"
            >
              <Text style={styles.connectButtonText}>Connect Mastodon</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const displayNameText = account.displayName || account.username;
  const usernameText = `@${account.username}`;
  const instanceText = account.instanceUrl ? new URL(account.instanceUrl).hostname : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Me',
          headerShown: true,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tappable Profile Area */}
        <TouchableOpacity 
          style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={handleViewProfile}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`View full profile. ${displayNameText}, ${usernameText}, ${instanceText}`}
          accessibilityHint="Double tap to view your complete profile"
        >
          <Image
            source={resolveImageSource(account.avatar)}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.displayName, { color: theme.text }]}>
              {displayNameText}
            </Text>
            <Text style={[styles.username, { color: theme.textSecondary }]}>
              {usernameText}
            </Text>
            <Text style={[styles.instance, { color: theme.textSecondary }]}>
              {instanceText}
            </Text>
          </View>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="arrow-forward"
            size={24}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={handleBookmarks}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Bookmarks"
            accessibilityHint="Double tap to view your bookmarked posts"
          >
            <IconSymbol
              ios_icon_name="bookmark.fill"
              android_material_icon_name="bookmark"
              size={24}
              color={theme.primary}
              style={{ marginRight: 16 }}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              Bookmarks
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={handleLists}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Lists"
            accessibilityHint="Double tap to manage your lists"
          >
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={24}
              color={theme.primary}
              style={{ marginRight: 16 }}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              Lists
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={handleSettings}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Double tap to open settings"
          >
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={24}
              color={theme.primary}
              style={{ marginRight: 16 }}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              Settings
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Disconnect Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.disconnectButton, { borderColor: theme.border }]}
            onPress={handleDisconnectConfirm}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Disconnect Mastodon account"
            accessibilityHint="Double tap to disconnect your Mastodon account"
          >
            <IconSymbol
              ios_icon_name="link.badge.minus"
              android_material_icon_name="link-off"
              size={20}
              color={theme.error}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.disconnectButtonText, { color: theme.error }]}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Disconnect Confirmation Modal */}
      <Modal
        visible={disconnectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDisconnectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={48}
              color={theme.warning}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Disconnect Account?
            </Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              Are you sure you want to disconnect your Mastodon account? You&apos;ll need to reconnect to use the app.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => setDisconnectModalVisible(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                accessibilityHint="Double tap to cancel disconnection"
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.error }]}
                onPress={handleDisconnect}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Disconnect"
                accessibilityHint="Double tap to confirm disconnection"
              >
                <Text style={styles.modalButtonTextConfirm}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={48}
              color={theme.primary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Info</Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="OK"
              accessibilityHint="Double tap to close"
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
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
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    marginBottom: 2,
  },
  instance: {
    fontSize: 12,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  connectButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirm: {
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
