import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';

// Conditionally import NativeTabs only on iOS
let NativeTabs: typeof import('expo-router/unstable-native-tabs').NativeTabs;
let Icon: typeof import('expo-router/unstable-native-tabs').Icon;
let Label: typeof import('expo-router/unstable-native-tabs').Label;

if (Platform.OS === 'ios') {
  const nativeTabsModule = require('expo-router/unstable-native-tabs');
  NativeTabs = nativeTabsModule.NativeTabs;
  Icon = nativeTabsModule.Icon;
  Label = nativeTabsModule.Label;
}

function IOSTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(explore)">
        <Label>Explore</Label>
        <Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} drawable="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(notifications)">
        <Label>Notifications</Label>
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} drawable="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <Label>Me</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} drawable="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidTabLayout() {
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
            <View accessible={false}>
              <IconSymbol
                ios_icon_name="house.fill"
                android_material_icon_name="home"
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(explore)"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore, 2 of 4',
          tabBarIcon: ({ color, size }) => (
            <View accessible={false}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarAccessibilityLabel: 'Notifications, 3 of 4',
          tabBarIcon: ({ color, size }) => (
            <View accessible={false}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Me',
          tabBarAccessibilityLabel: 'Me, 4 of 4',
          tabBarIcon: ({ color, size }) => (
            <View accessible={false}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === 'ios') {
    return <IOSTabLayout />;
  }
  return <AndroidTabLayout />;
}
