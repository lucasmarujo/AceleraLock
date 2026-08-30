import { StyleSheet, Text, View } from 'react-native';

import { radius, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** `null` cai pro ícone genérico — a ordem de fallback do §3.17. */
  nome: string | null;
  size?: 24 | 32 | 40 | 64;
};

/**
 * docs/design-system.md §3.17. Sem imagem de perfil no produto: o fallback da
 * doc (imagem -> iniciais -> generico) comeca nas iniciais.
 */
export function Avatar({ nome, size = 64 }: Props) {
  const theme = useTheme();
  const iniciais = extrairIniciais(nome);

  return (
    <View
      style={[
        styles.circulo,
        { width: size, height: size, backgroundColor: theme.colors.bgBrandSubtle },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.iniciais, { color: theme.colors.textBrand, fontSize: size * 0.36 }]}>
        {iniciais}
      </Text>
    </View>
  );
}

/** Primeira letra do primeiro e do ultimo nome; uma so quando ha um nome so. */
export function extrairIniciais(nome: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return '?';
  }
  if (partes.length === 1) {
    return partes[0].charAt(0).toLocaleUpperCase('pt-BR');
  }
  const primeira = partes[0].charAt(0);
  const ultima = partes[partes.length - 1].charAt(0);
  return `${primeira}${ultima}`.toLocaleUpperCase('pt-BR');
}

const styles = StyleSheet.create({
  circulo: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciais: {
    fontWeight: typography.title2.fontWeight,
  },
});
