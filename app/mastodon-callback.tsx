
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function MastodonCallbackScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('MastodonCallbackScreen mounted with params:', params);
    
    // This screen is just a landing page for the OAuth callback
    // The actual handling is done in connect-mastodon.tsx via deep link listener
    // After a brief moment, redirect back to the connect screen
    const timer = setTimeout(() => {
      console.log('Redirecting back to connect-mastodon screen');
      router.replace('/connect-mastodon');
    }, 1000);

    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.text, { color: theme.text }]}>
        Completing authentication...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
