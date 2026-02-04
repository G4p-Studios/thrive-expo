
import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@react-navigation/native';

export default function TabLayout() {
  const theme = useTheme();

  // Define colors for tabs based on theme
  const activeColor = theme.colors.primary;
  const inactiveColor = theme.dark ? '#ADADAD' : '#666666';

  return (
    <NativeTabs
      tintColor={activeColor}
      iconColor={{
        default: inactiveColor,
        selected: activeColor,
      }}
      labelStyle={{
        default: { color: inactiveColor },
        selected: { color: activeColor },
      }}
    >
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(explore)">
        <Label>Explore</Label>
        <Icon drawable="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(notifications)">
        <Label>Notifications</Label>
        <Icon drawable="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <Label>Me</Label>
        <Icon drawable="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
