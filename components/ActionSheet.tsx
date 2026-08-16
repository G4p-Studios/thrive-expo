import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export interface ActionSheetItem {
  key: string;
  label: string;
  /** Shown under the label, and used as the accessibility hint. */
  hint?: string;
  ios: string;
  android: any;
  /** Renders in the error colour, for actions people should not hit by accident. */
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}

/**
 * A bottom sheet of secondary actions.
 *
 * Actions that are easy to trigger by mistake — reporting, blocking — live here
 * rather than beside reply and boost, so reaching them is deliberate.
 */
export default function ActionSheet({ visible, onClose, title, items }: ActionSheetProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {title ? (
            <Text
              style={[styles.title, { color: theme.textSecondary }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null}

          <ScrollView bounces={false}>
            {items.map(item => (
              <TouchableOpacity
                key={item.key}
                style={styles.row}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.hint}
              >
                <IconSymbol
                  ios_icon_name={item.ios}
                  android_material_icon_name={item.android}
                  size={22}
                  color={item.destructive ? theme.error : theme.textSecondary}
                  accessible={false}
                />
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: item.destructive ? theme.error : theme.text },
                    ]}
                    accessible={false}
                  >
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text
                      style={[styles.rowHint, { color: theme.textSecondary }]}
                      accessible={false}
                    >
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.cancel, { borderColor: theme.border }]}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '70%',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 17,
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
