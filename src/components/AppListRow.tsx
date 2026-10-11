import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconeApp } from '@/components/IconeApp';
import { Interruptor } from '@/components/Interruptor';
import type { InstalledApp } from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  app: InstalledApp;
  marcado: boolean;
  onToggle: () => void;
  /**
   * `switch` na aba Bloqueios (liga/desliga o bloqueio de um app ja escolhido);
   * `check` no onboarding (escolha numa lista).
   */
  variante?: 'switch' | 'check';
  /** Estado por extenso sob o nome ("Bloqueado", "Bloqueia ao salvar"). */
  legenda?: string | null;
  /** Legenda na cor da marca: so o que esta de fato bloqueado agora. */
  legendaDestacada?: boolean;
  disabled?: boolean;
  /** Acao extra antes do interruptor (horarios livres). So na variante `switch`. */
  acao?: ReactNode;
};

/** Linha do `switch`: 12 + icone 40 + 12. */
export const APP_ROW_HEIGHT = 64;
/** Linha do `check` (onboarding): 10 + icone 36 + 10. */
export const APP_ROW_HEIGHT_CHECK = 56;

/**
 * docs/design-system.md §3.8. Uma linha por app, sem cartao proprio — vive
 * dentro de `Grupo`. Linha marcada no modo `check` ganha fundo de marca; o
 * estado vai tambem em texto e no `accessibilityState`, nunca so na cor.
 */
export function AppListRow({
  app,
  marcado,
  onToggle,
  variante = 'switch',
  legenda,
  legendaDestacada = false,
  disabled = false,
  acao,
}: Props) {
  const theme = useTheme();
  const destacado = variante === 'check' && marcado;

  const textos = (
    <View style={styles.textos}>
      <Text style={[styles.rotulo, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {app.label}
      </Text>
      {legenda && (
        <Text
          style={[
            styles.legenda,
            { color: legendaDestacada ? theme.colors.textBrand : theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {legenda}
        </Text>
      )}
    </View>
  );

  if (variante === 'check') {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={app.label}
        accessibilityState={{ checked: marcado, disabled }}
        onPress={disabled ? undefined : onToggle}
        style={({ pressed }) => [
          styles.linha,
          styles.linhaCheck,
          destacado && { backgroundColor: theme.colors.bgBrandSubtle },
          pressed && !destacado && { backgroundColor: theme.colors.bgSunken },
        ]}
      >
        <IconeApp iconUri={app.iconUri} tamanho={36} />
        {textos}
        <View
          style={[
            styles.check,
            marcado
              ? { backgroundColor: theme.colors.borderBrand, borderColor: theme.colors.borderBrand }
              : { borderColor: theme.colors.borderStrong },
          ]}
        >
          {marcado && <Ionicons name="checkmark" size={14} color={theme.colors.bgSurface} />}
        </View>
      </Pressable>
    );
  }

  // Travada (modo restrito) so o interruptor apaga: nome e icone continuam
  // legiveis — a lista existe pra ser vista, so nao pra ser mexida.
  return (
    <View style={[styles.linha, styles.linhaSwitch]}>
      <IconeApp iconUri={app.iconUri} tamanho={40} />
      {textos}
      {acao}
      <Interruptor
        valor={marcado}
        onChange={onToggle}
        accessibilityLabel={app.label}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
  },
  linhaCheck: {
    paddingVertical: spacing[2] + 2,
    minHeight: APP_ROW_HEIGHT_CHECK,
  },
  linhaSwitch: {
    paddingVertical: spacing[3],
    minHeight: APP_ROW_HEIGHT,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  rotulo: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
  },
  legenda: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
