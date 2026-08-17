import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** No payload — the event itself is the whole message. */
export type AccessibilityFocusEventPayload = Record<string, never>;

export type AccessibilityFocusViewProps = PropsWithChildren<{
  /** Screen reader focus entered this view or something inside it. */
  onAccessibilityFocus?: (event: { nativeEvent: AccessibilityFocusEventPayload }) => void;
  /** Screen reader focus left. */
  onAccessibilityBlur?: (event: { nativeEvent: AccessibilityFocusEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
}>;
