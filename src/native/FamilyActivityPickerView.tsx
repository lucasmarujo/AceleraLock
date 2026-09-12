import { type ComponentType } from 'react';
import { Platform } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

type FamilyActivityPickerViewProps = {
  headerText?: string;
  style?: object;
};

const NativeView: ComponentType<FamilyActivityPickerViewProps> | null =
  Platform.OS === 'ios'
    ? requireNativeViewManager<FamilyActivityPickerViewProps>(
        'AceleralockBlocker',
        'FamilyActivityPickerExpoView'
      )
    : null;

export function FamilyActivityPickerView(props: FamilyActivityPickerViewProps) {
  if (!NativeView) {
    return null;
  }
  return <NativeView {...props} />;
}
