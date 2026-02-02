
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
  Platform,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { MastodonAccount } from '@/types/mastodon';
import { verifyCredentials, getAccountCache, getInstanceUrl } from '@/lib/mastodon';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function ProfileDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [account, setAccount] = useState<MastodonAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('ProfileDetailScreen mounted, loading full profile');
    loadFullProfile();
  }, []);

  const loadFullProfile = async () => {
    try {
      console.log('Fetching full Mastodon profile');
      // First try cached account
      const cachedAccount = await getAccountCache();
      if (cachedAccount) {
        const instanceUrl = await getInstanceUrl();
        setAccount({ ...cachedAccount, instanceUrl: instanceUrl || cachedAccount.instanceUrl });
      }

      // Then fetch fresh data
      const freshAccount = await verifyCredentials();
      const instanceUrl = await getInstanceUrl();
      setAccount({ ...freshAccount, instanceUrl: instanceUrl || '' });
    } catch (error: any) {
      console.error('Failed to load full profile:', error);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Profile',
            headerShown: true,
            headerBackTitle: 'Back',
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
            title: 'Profile',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            Unable to load profile
          </Text>
        </View>
      </View>
    );
  }

  const displayNameText = account.displayName || account.username;
  const usernameText = `@${account.username}`;
  const instanceText = account.instanceUrl ? new URL(account.instanceUrl).hostname : '';
  const followersCountText = account.followersCount?.toString() || '0';
  const followingCountText = account.followingCount?.toString() || '0';
  const statusesCountText = account.statusesCount?.toString() || '0';
  const bioText = account.note ? account.note.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Profile',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView>
        {/* Header Image */}
        {account.header ? (
          <Image
            source={resolveImageSource(account.header)}
            style={styles.headerImage}
          />
        ) : (
          <View style={[styles.headerImage, { backgroundColor: theme.primary }]} />
        )}

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <Image
            source={resolveImageSource(account.avatar)}
            style={[styles.avatar, { borderColor: theme.background }]}
          />
          
          <View style={styles.nameSection}>
            <Text style={[styles.displayName, { color: theme.text }]}>
              {displayNameText}
            </Text>
            <Text style={[styles.username, { color: theme.textSecondary }]}>
              {usernameText}
            </Text>
          </View>

          {bioText ? (
            <Text style={[styles.bio, { color: theme.text }]}>
              {bioText}
            </Text>
          ) : null}

          <Text style={[styles.instance, { color: theme.textSecondary }]}>
            {instanceText}
          </Text>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {statusesCountText}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Posts
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {followingCountText}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Following
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {followersCountText}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Followers
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              accessibilityHint="Double tap to edit your profile"
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  headerImage: {
    height: 150,
    width: '100%',
  },
  profileSection: {
    padding: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: -50,
    borderWidth: 4,
  },
  nameSection: {
    marginTop: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  instance: {
    fontSize: 14,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
