import { View } from 'react-native';

import { AccessibilityFocusViewProps } from './AccessibilityFocus.types';

/**
 * Web has no equivalent focus notification, and throwing here would take the
 * whole screen down. Rendering a plain passthrough means callers can wrap
 * anything unconditionally and simply get no events on web.
 */
export default function AccessibilityFocusView({
  children,
  style,
}: AccessibilityFocusViewProps) {
  return <View style={style}>{children}</View>;
}
