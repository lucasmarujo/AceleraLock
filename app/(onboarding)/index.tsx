import { useEffect, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { readOnboardingComplete } from '@/state/onboardingStorage';
import { brand, duration, easing, neutral, radius, spacing, typography } from '@/theme/tokens';

const BADGE = require('../../assets/png/mark/lock-3d-trail-1024.png');

const BADGE_SIZE = 168;
const ANEL_SIZE = 200;
const PULSO_MS = 2600;

/**
 * Superficie de marca *fixa*: e a unica tela do app que nao responde ao
 * `useColorScheme`. O degrade vai do turquesa ao tema nas duas pontas
 * (`brand.turquesa` -> `brand.tema`, docs/design-system.md §1.1), entao o
 * contraste de texto so fecha com neutros claros — trocar por token semantico
 * de tema quebraria a leitura no claro. Nao "consertar" pra seguir o tema.
 *
 * O primario tambem escapa da inversao clara/escura de `surfaces.brand` pelo
 * mesmo motivo, via a prop `surface` do `Button`.
 */
const SUPERFICIE_MARCA = {
  fill: brand.turquesa,
  onFill: brand.tema,
  pressedFill: brand.turquesaPressedDark,
};

function useEntrada(atrasoMs: number, reduzido: boolean) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    progresso.value = withDelay(
      reduzido ? 0 : atrasoMs,
      withTiming(1, {
        duration: reduzido ? duration.instant : duration.base,
        easing: Easing.bezier(...easing.decelerate),
      })
    );
  }, [atrasoMs, progresso, reduzido]);

  return useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [{ translateY: (1 - progresso.value) * 12 }],
  }));
}

function Anel({ atrasoMs, reduzido }: { atrasoMs: number; reduzido: boolean }) {
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (reduzido) {
      return;
    }
    pulso.value = withDelay(
      atrasoMs,
      withRepeat(
        withTiming(1, { duration: PULSO_MS, easing: Easing.bezier(...easing.decelerate) }),
        -1,
        false
      )
    );
  }, [atrasoMs, pulso, reduzido]);

  const estilo = useAnimatedStyle(() => ({
    opacity: (1 - pulso.value) * 0.45,
    transform: [{ scale: 1 + pulso.value * 1.2 }],
  }));

  if (reduzido) {
    return null;
  }

  return <Animated.View pointerEvents="none" style={[styles.anel, estilo]} />;
}

export default function OnboardingBoasVindas() {
  const router = useRouter();
  const reduzido = useReducedMotion();
  // `null` enquanto a leitura nao voltou: so o degrade aparece. Sao poucos ms,
  // e e o que impede a tela de boas-vindas de piscar pra quem so caiu de volta
  // no onboarding porque revogou uma permissao.
  const [primeiraVez, setPrimeiraVez] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    readOnboardingComplete()
      .then((concluido) => {
        if (!ativo) {
          return;
        }
        if (concluido) {
          router.replace('/passos');
          return;
        }
        setPrimeiraVez(true);
      })
      .catch(() => ativo && setPrimeiraVez(true));
    return () => {
      ativo = false;
    };
  }, [router]);

  useEffect(() => {
    // Primeiro passo do grupo: nao ha passo anterior pra voltar, entao engolir
    // aqui e inambiguo (nunca "as vezes navega, as vezes fecha o app"). Decisao
    // herdada do fluxo antigo — o voltar fisico nunca fecha o app sozinho, quem
    // sai do onboarding sai pelo link "Sair" abaixo do CTA.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const estiloTitulo = useEntrada(500, reduzido);
  const estiloSubtitulo = useEntrada(620, reduzido);
  const estiloCta = useEntrada(740, reduzido);
  const estiloBadge = useEntrada(0, reduzido);

  return (
    <View style={styles.raiz}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <LinearGradient
        colors={[brand.turquesa, brand.tema]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {primeiraVez && (
        <SafeAreaView style={styles.conteudo}>
          <Animated.View style={[styles.cabecalho, estiloTitulo]}>
            <Text style={styles.titulo}>Bem-vindo ao AceleraLock</Text>
          </Animated.View>
          <Animated.Text style={[styles.subtitulo, estiloSubtitulo]}>
            Tome controle sobre o seu tempo de tela
          </Animated.Text>

          <Animated.View style={[styles.palco, estiloBadge]}>
            <Anel atrasoMs={0} reduzido={reduzido} />
            <Anel atrasoMs={PULSO_MS / 2} reduzido={reduzido} />
            <Image
              source={BADGE}
              style={styles.badge}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel="AceleraLock"
            />
          </Animated.View>

          <Animated.View style={[styles.rodape, estiloCta]}>
            <Button
              label="Vamos começar"
              surface={SUPERFICIE_MARCA}
              onPress={() => router.push('/passos')}
            />
            {/*
              Mesma porta de saida do fluxo antigo (era o link do
              `OnboardingStepScreen`): subordinada ao CTA de proposito, sem
              virar `Button`, pra nao competir com "Vamos começar". So Android
              — nao existe API publica de auto-encerramento no iOS.
            */}
            {Platform.OS === 'android' && (
              <Pressable accessibilityRole="button" onPress={() => BackHandler.exitApp()}>
                <Text style={styles.sair}>Sair</Text>
              </Pressable>
            )}
          </Animated.View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: brand.tema,
  },
  conteudo: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[6],
  },
  cabecalho: {
    paddingTop: spacing[8],
  },
  titulo: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
    textAlign: 'center',
    color: neutral[0],
  },
  subtitulo: {
    marginTop: spacing[3],
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    color: neutral[200],
  },
  palco: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anel: {
    position: 'absolute',
    width: ANEL_SIZE,
    height: ANEL_SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: neutral[0],
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
  rodape: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing[4],
  },
  sair: {
    color: neutral[300],
    textDecorationLine: 'underline',
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
});
