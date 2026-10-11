import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type Props = {
  iconUri: string | null;
  tamanho?: number;
  /** Borda na cor do fundo, pra pilha de icones sobrepostos. */
  contorno?: string;
};

/**
 * Icone de launcher do app, ou o mesmo espaco vazio quando nao da pra ler —
 * lista que muda de alinhamento no meio e pior que lista sem icone.
 */
export function IconeApp({ iconUri, tamanho = 40, contorno }: Props) {
  const theme = useTheme();
  const raio = Math.round(tamanho * 0.28);
  const moldura = contorno ? { borderWidth: 2, borderColor: contorno } : null;

  if (!iconUri) {
    return (
      <View
        style={[
          styles.base,
          { width: tamanho, height: tamanho, borderRadius: raio },
          { backgroundColor: theme.colors.bgSunken },
          moldura,
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri: iconUri }}
      style={[styles.base, { width: tamanho, height: tamanho, borderRadius: raio }, moldura]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
