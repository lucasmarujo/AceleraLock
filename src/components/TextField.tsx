import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tamanho = 'sm' | 'md' | 'lg';

type Props = {
  value: string;
  onChangeText: (texto: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** Rotulo visivel acima (DS §3.10): placeholder nunca faz papel de rotulo. */
  label?: string;
  /** Linha de apoio sob o campo. Substituida por `error` quando houver. */
  helper?: string;
  /** Erro que diz como resolver, nao so que esta errado. */
  error?: string | null;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** Acao dentro do campo, a direita (ex.: "Adicionar"). */
  trailing?: ReactNode;
  /** `sm` busca (48), `md` campo com acao (52), `lg` campo principal da tela (56). */
  tamanho?: Tamanho;
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  autoCorrect?: boolean;
  editable?: boolean;
};

const ALTURA: Record<Tamanho, number> = { sm: 48, md: 52, lg: 56 };

/** Espessura do halo de foco, desenhado fora da caixa. */
const HALO = 4;

export function TextField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  label,
  helper,
  error,
  leadingIcon,
  trailing,
  tamanho = 'md',
  autoFocus = false,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize,
  keyboardType,
  autoCorrect,
  editable = true,
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const corDaBorda = error
    ? theme.colors.textDanger
    : focused
      ? theme.colors.borderBrand
      : theme.colors.borderStrong;

  return (
    <View style={styles.campo}>
      {label && <Text style={[styles.rotulo, { color: theme.colors.textPrimary }]}>{label}</Text>}
      <View>
        {focused && !error && (
          <View
            pointerEvents="none"
            style={[styles.halo, { backgroundColor: theme.colors.focusRing }]}
          />
        )}
        <View
          style={[
            styles.caixa,
            {
              height: ALTURA[tamanho],
              backgroundColor: theme.colors.bgSurface,
              borderColor: corDaBorda,
              borderWidth: focused || error ? 2 : 1,
              paddingLeft: leadingIcon ? spacing[3] + 2 : spacing[4],
              paddingRight: trailing ? spacing[1] + 2 : spacing[4],
            },
          ]}
        >
          {leadingIcon && (
            <Ionicons name={leadingIcon} size={20} color={theme.colors.textTertiary} />
          )}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled: !editable }}
            autoFocus={autoFocus}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoCorrect={autoCorrect}
            editable={editable}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxFontSizeMultiplier={1.3}
            style={[styles.input, { color: theme.colors.textPrimary }]}
          />
          {trailing}
        </View>
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.apoio, { color: theme.colors.textDanger }]}
        >
          {error}
        </Text>
      ) : (
        helper && (
          <Text style={[styles.apoio, { color: theme.colors.textSecondary }]}>{helper}</Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: {
    alignSelf: 'stretch',
    gap: spacing[2],
  },
  rotulo: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  halo: {
    position: 'absolute',
    top: -HALO,
    left: -HALO,
    right: -HALO,
    bottom: -HALO,
    borderRadius: radius.md + HALO,
    opacity: 0.14,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  apoio: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
});
