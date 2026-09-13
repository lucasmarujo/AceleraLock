import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  value: string;
  onChangeText: (texto: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  autoCorrect?: boolean;
};

const HEIGHT = 52;

/**
 * docs/design-system.md §3.10. Mesmo anel de foco do `Button`: um View de fora
 * com borda de 2px, pra o anel nunca comer o padding do campo nem mudar a
 * altura da linha quando aparece.
 *
 * Sem rotulo visivel por decisao de layout — as duas telas que usam o campo ja
 * tem a pergunta como titulo logo acima -, entao `accessibilityLabel` e
 * obrigatorio: placeholder sozinho some pro leitor de tela assim que a pessoa
 * digita a primeira letra.
 */
export function TextField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  autoFocus = false,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize,
  keyboardType,
  autoCorrect,
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.focusRing,
        { borderRadius: radius.md + 4 },
        focused && { borderColor: theme.colors.focusRing },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={autoCorrect}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={1.3}
        style={[
          styles.input,
          {
            borderRadius: radius.md,
            backgroundColor: theme.colors.bgSurface,
            borderColor: focused ? theme.colors.borderBrand : theme.colors.borderDefault,
            color: theme.colors.textPrimary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  focusRing: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  input: {
    height: HEIGHT,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
