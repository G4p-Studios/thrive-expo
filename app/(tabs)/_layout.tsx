import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';

export default function TabLayout() {
  const theme = useTheme();

  const activeColor = theme.colors.primary;
  const inactiveColor = theme.dark ? '#ADADAD' : '#666666';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home, 1 of 4',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="house.fill"
              android_material_icon_name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(explore)"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore, 2 of 4',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarAccessibilityLabel: 'Notifications, 3 of 4',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Me',
          tabBarAccessibilityLabel: 'Me, 4 of 4',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
