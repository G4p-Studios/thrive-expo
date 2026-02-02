
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { isAuthenticated } from '@/lib/mastodon';

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.log('\n' + '='.repeat(80));
    console.log('THRIVE - Mastodon Client');
    console.log('='.repeat(80));
    console.log('\nDirect Mastodon API - No backend required');
    console.log('='.repeat(80) + '\n');
  }, []);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      console.log('[Index] Checking authentication status...');
      const authenticated = await isAuthenticated();

      if (authenticated) {
        console.log('[Index] Session found, redirecting to home');
        router.replace('/(tabs)/(home)');
      } else {
        console.log('[Index] No session, redirecting to connect');
        router.replace('/connect-mastodon');
      }
    } catch (error) {
      console.error('[Index] Error checking authentication:', error);
      router.replace('/connect-mastodon');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
