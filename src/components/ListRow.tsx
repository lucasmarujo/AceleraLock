import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  /** Texto a direita: valor, estado, duracao. */
  value?: string;
  icon?: ReactNode;
  /** Controle a direita no lugar do texto (Switch, botao de editar). */
  accessory?: ReactNode;
  onPress?: () => void;
  /** Pinta o valor com a cor de marca — para "concedida", "ativa". */
  emphasis?: 'default' | 'brand' | 'danger';
  /**
   * Marca a linha como opcao de uma escolha unica. Definir isto troca o papel
   * de acessibilidade de `button` pra `radio`: sem isto, uma lista de temas
   * seria anunciada como tres botoes soltos, sem dizer qual esta ativo.
   * Ausente mantem o comportamento de antes.
   */
  selected?: boolean;
};

const MIN_HEIGHT = 48;

/** docs/design-system.md §3.19. Altura minima de 48 e do proprio §3.19. */
export function ListRow({
  label,
  value,
  icon,
  accessory,
  onPress,
  emphasis = 'default',
  selected,
}: Props) {
  const theme = useTheme();
  const corDoValor = {
    default: theme.colors.textSecondary,
    brand: theme.colors.textBrand,
    danger: theme.colors.textDanger,
  }[emphasis];

  const conteudo = (
    <>
      {icon}
      <Text style={[styles.label, { color: theme.colors.textPrimary }]} numberOfLines={2}>
        {label}
      </Text>
      {value !== undefined && (
        <Text style={[styles.value, { color: corDoValor }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      {accessory}
    </>
  );

  if (!onPress) {
    return <View style={styles.linha}>{conteudo}</View>;
  }

  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linha,
        pressed && { backgroundColor: theme.colors.bgSunken, borderRadius: radius.sm },
      ]}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: MIN_HEIGHT,
    paddingHorizontal: spacing[2],
  },
  label: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  value: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
});
