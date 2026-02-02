
import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <Label>Explore</Label>
        <Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} drawable="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Label>Notifications</Label>
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} drawable="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Me</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} drawable="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
