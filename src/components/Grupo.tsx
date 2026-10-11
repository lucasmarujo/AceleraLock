import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Rotulo de secao em caixa alta (`caption`), acima de um grupo. */
export function Overline({ children, cor }: { children: string; cor?: string }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.overline, { color: cor ?? theme.colors.textTertiary }]}
    >
      {children}
    </Text>
  );
}

type Props = {
  titulo?: string;
  /** Texto a direita do titulo ("2 pendentes"). */
  detalhe?: string;
  corDoDetalhe?: string;
  children: ReactNode;
};

/**
 * Secao com titulo e um cartao so, linhas separadas por divisoria. Substitui o
 * cartao-por-linha: muitas bordas competindo faziam a lista parecer mais pesada
 * do que e.
 */
export function Grupo({ titulo, detalhe, corDoDetalhe, children }: Props) {
  const theme = useTheme();
  const itens = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.secao}>
      {(titulo || detalhe) && (
        <View style={styles.cabecalho}>
          {titulo ? <Overline>{titulo}</Overline> : <View />}
          {detalhe && (
            <Text style={[styles.detalhe, { color: corDoDetalhe ?? theme.colors.textTertiary }]}>
              {detalhe}
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.cartao,
          { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
        ]}
      >
        {itens.map((item, indice) => (
          <Fragment key={indice}>
            {indice > 0 && (
              <View style={[styles.divisoria, { backgroundColor: theme.colors.borderDefault }]} />
            )}
            {item}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: spacing[2],
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  overline: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  detalhe: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
  },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  divisoria: {
    height: StyleSheet.hairlineWidth,
  },
});
