import { StyleSheet, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  width: number | `${number}%`;
  height: number;
};

/**
 * docs/design-system.md §3.16. ponytail: sem shimmer — a doc só exige
 * "estático sob reduce-motion", e um placeholder parado já satisfaz isso
 * sem depender de reanimated. Adicionar shimmer (respeitando
 * AccessibilityInfo.isReduceMotionEnabled) se o produto pedir.
 */
export function Skeleton({ width, height }: Props) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width, height, backgroundColor: theme.colors.bgSunken, borderRadius: radius.sm },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
