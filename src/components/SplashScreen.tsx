import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const BADGE = require('../../assets/alock-badge.png');
const ACELERADEV = require('../../assets/aceleradev-logo.png');

/**
 * Splash de marca (docs/design-system.md §3.24): o badge do AceleraLock, o
 * nome, e a assinatura "Made By" + logo do AceleraDev.
 *
 * É uma tela do app, não a imagem da splash nativa, porque o lockup não cabe
 * lá: a splash do Android 12+ recorta o que mostra num círculo e aceita um
 * ícone só — texto e uma segunda logo não sobrevivem ao recorte. A splash
 * nativa mostra só o badge (`assets/splash-icon.png`, gerado com folga pra
 * essa máscara) e esta tela continua a partir dele, no mesmo fundo, pra
 * transição não piscar.
 *
 * Sem `<Svg>` de propósito: o app não tem react-native-svg, e as duas logos
 * são PNG geradas por `assets/brand/build-icons.py` e
 * `assets/brand/build-aceleradev-logo.py`.
 */
export function SplashScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <View style={styles.brand}>
        <Image
          source={BADGE}
          style={styles.badge}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={[styles.name, { color: theme.colors.textPrimary }]}>AceleraLock</Text>
      </View>

      <View style={styles.signature}>
        <Text style={[styles.madeBy, { color: theme.colors.textTertiary }]}>Made By</Text>
        <Image
          source={ACELERADEV}
          style={styles.aceleradev}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel="AceleraDev"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
  },
  badge: {
    width: 128,
    height: 128,
  },
  name: {
    fontSize: typography.title1.fontSize,
    lineHeight: typography.title1.lineHeight,
    fontWeight: typography.title1.fontWeight,
    textAlign: 'center',
  },
  signature: {
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[8],
  },
  madeBy: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
    textAlign: 'center',
  },
  aceleradev: {
    // Maior que um mark simples de propósito: a logo do AceleraDev tem
    // wordmark dentro do disco, e abaixo disso "ACELERA/DEV" não se lê.
    width: 76,
    height: 76,
  },
});
