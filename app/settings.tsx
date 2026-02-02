
import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoPlayMedia, setAutoPlayMedia] = useState(false);
  const [showSensitiveContent, setShowSensitiveContent] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  const handleNotificationsToggle = (value: boolean) => {
    console.log('User toggled notifications:', value);
    setNotificationsEnabled(value);
    setInfoMessage(value ? 'Notifications enabled' : 'Notifications disabled');
    setInfoModalVisible(true);
  };

  const handleAutoPlayToggle = (value: boolean) => {
    console.log('User toggled auto-play media:', value);
    setAutoPlayMedia(value);
    setInfoMessage(value ? 'Media will auto-play' : 'Media auto-play disabled');
    setInfoModalVisible(true);
  };

  const handleSensitiveContentToggle = (value: boolean) => {
    console.log('User toggled sensitive content:', value);
    setShowSensitiveContent(value);
    setInfoMessage(value ? 'Sensitive content will be shown' : 'Sensitive content will be hidden');
    setInfoModalVisible(true);
  };

  const handleAbout = () => {
    console.log('User tapped About');
    setInfoMessage('Thrive - A Mastodon client\nVersion 1.0.0\n\nBuilt with React Native and Expo');
    setInfoModalVisible(true);
  };

  const handlePrivacy = () => {
    console.log('User tapped Privacy Policy');
    setInfoMessage('Privacy Policy\n\nThis app does not collect or store any personal data beyond what is necessary to connect to your Mastodon instance.');
    setInfoModalVisible(true);
  };

  const handleHelp = () => {
    console.log('User tapped Help');
    setInfoMessage('Help & Support\n\nFor help with using this app, please visit the Mastodon documentation or contact your instance administrator.');
    setInfoModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            PREFERENCES
          </Text>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  Receive push notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Notifications toggle"
              accessibilityHint={`Notifications are currently ${notificationsEnabled ? 'enabled' : 'disabled'}. Double tap to toggle`}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="play.circle.fill"
                android_material_icon_name="play-arrow"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  Auto-play Media
                </Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  Automatically play videos and GIFs
                </Text>
              </View>
            </View>
            <Switch
              value={autoPlayMedia}
              onValueChange={handleAutoPlayToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Auto-play media toggle"
              accessibilityHint={`Auto-play is currently ${autoPlayMedia ? 'enabled' : 'disabled'}. Double tap to toggle`}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="eye.slash.fill"
                android_material_icon_name="visibility-off"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  Show Sensitive Content
                </Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  Display content marked as sensitive
                </Text>
              </View>
            </View>
            <Switch
              value={showSensitiveContent}
              onValueChange={handleSensitiveContentToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Show sensitive content toggle"
              accessibilityHint={`Sensitive content is currently ${showSensitiveContent ? 'shown' : 'hidden'}. Double tap to toggle`}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ABOUT
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleAbout}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="About"
            accessibilityHint="Double tap to view app information"
          >
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                About
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handlePrivacy}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Privacy Policy"
            accessibilityHint="Double tap to view privacy policy"
          >
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                Privacy Policy
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleHelp}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Help & Support"
            accessibilityHint="Double tap to view help information"
          >
            <View style={styles.settingInfo}>
              <IconSymbol
                ios_icon_name="questionmark.circle.fill"
                android_material_icon_name="help"
                size={24}
                color={theme.primary}
                style={{ marginRight: 16 }}
              />
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                Help & Support
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
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
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              {infoMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => setInfoModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="OK"
              accessibilityHint="Double tap to close"
            >
              <Text style={styles.modalButtonText}>OK</Text>
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
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
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
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButton: {
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
