
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Href } from 'expo-router';

export default function TabLayout() {
  const tabs = [
    {
      name: 'Home',
      route: '/(tabs)/(home)' as Href,
      ios_icon_name: 'house.fill',
      android_material_icon_name: 'home',
    },
    {
      name: 'Explore',
      route: '/(tabs)/(explore)' as Href,
      ios_icon_name: 'magnifyingglass',
      android_material_icon_name: 'search',
    },
    {
      name: 'Notifications',
      route: '/(tabs)/(notifications)' as Href,
      ios_icon_name: 'bell.fill',
      android_material_icon_name: 'notifications',
    },
    {
      name: 'Me',
      route: '/(tabs)/(profile)' as Href,
      ios_icon_name: 'person.fill',
      android_material_icon_name: 'person',
    },
  ];

  return (
    <View style={styles.container}>
      <Stack>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="(explore)" options={{ headerShown: false }} />
        <Stack.Screen name="(notifications)" options={{ headerShown: false }} />
        <Stack.Screen name="(profile)" options={{ headerShown: false }} />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
