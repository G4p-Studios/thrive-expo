import { requireNativeView } from 'expo';
import * as React from 'react';

import { AccessibilityFocusViewProps } from './AccessibilityFocus.types';

const NativeView: React.ComponentType<AccessibilityFocusViewProps> = requireNativeView('AccessibilityFocus');

export default function AccessibilityFocusView(props: AccessibilityFocusViewProps) {
  return <NativeView {...props} />;
}
