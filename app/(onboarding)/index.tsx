import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { readOnboardingComplete } from '@/state/onboardingStorage';
import AceleralockBlocker from '@/native/blocker';
import {
  amber,
  brand,
  duration,
  easing,
  neutral,
  radius,
  spacing,
  temaNeutral,
  typography,
} from '@/theme/tokens';

const BADGE = require('../../assets/icon-1024.png');

const BADGE_SIZE = 88;

/** Fonte da marca no overline (Paper: Roboto Mono). */
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Promessa = { icone: keyof typeof Ionicons.glyphMap; cor: string; texto: string };

function promessas(esperaMinutos: number): Promessa[] {
  return [
    {
      icone: 'shield-outline',
      cor: brand.turquesa,
      texto: 'Bloqueia os apps e sites que você escolher',
    },
    {
      icone: 'hourglass-outline',
      cor: amber[300],
      texto: `Mudar de ideia pode pedir ${esperaMinutos} min de espera`,
    },
    {
      icone: 'phone-portrait-outline',
      cor: neutral[300],
      texto: 'Tudo fica no seu celular. Sem conta.',
    },
  ];
}

/**
 * Superficie de marca *fixa*: e a unica tela do app que nao responde ao
 * `useColorScheme`. Desde o redesign (2026-10-11) o degrade e escuro nas duas
 * pontas (`brand.temaTurquesa` -> `brand.tema`): o turquesa claro de antes
 * deixava o texto branco do topo abaixo de 4.5:1. O contraste so fecha com
 * neutros claros — trocar por token semantico de tema quebraria a leitura no
 * claro. Nao "consertar" pra seguir o tema.
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
    // sai do onboarding sai pelo link "Sair do app" abaixo do CTA.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const { waitMinutes } = AceleralockBlocker.protectionState();
  const estiloBadge = useEntrada(0, reduzido);
  const estiloTitulo = useEntrada(120, reduzido);
  const estiloPromessas = useEntrada(260, reduzido);
  const estiloCta = useEntrada(400, reduzido);

  return (
    <View style={styles.raiz}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <LinearGradient
        colors={[brand.temaTurquesa, brand.tema]}
        locations={[0, 0.58]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {primeiraVez && (
        <SafeAreaView style={styles.conteudo}>
          <View style={styles.topo}>
            <Animated.View style={estiloBadge}>
              <Image
                source={BADGE}
                style={styles.badge}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                accessibilityLabel="AceleraLock"
              />
            </Animated.View>

            <Animated.View style={[styles.cabecalho, estiloTitulo]}>
              <Text style={styles.marca}>ACELERALOCK</Text>
              <Text accessibilityRole="header" style={styles.titulo}>
                Faça o impulso esperar.
              </Text>
              <Text style={styles.subtitulo}>
                Escolha os apps que roubam seu tempo. Quando bater a vontade de abrir, o AceleraLock
                fica no caminho.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.promessas, estiloPromessas]}>
              {promessas(waitMinutes).map((promessa) => (
                <View key={promessa.icone} style={styles.promessa}>
                  <View style={styles.iconePromessa}>
                    <Ionicons name={promessa.icone} size={18} color={promessa.cor} />
                  </View>
                  <Text style={styles.textoPromessa}>{promessa.texto}</Text>
                </View>
              ))}
            </Animated.View>
          </View>

          <View style={styles.espaco} />

          <Animated.View style={[styles.rodape, estiloCta]}>
            <Button
              label="Começar"
              surface={SUPERFICIE_MARCA}
              onPress={() => router.push('/passos')}
            />
            {/*
              Mesma porta de saida do fluxo antigo (era o link do
              `OnboardingStepScreen`): subordinada ao CTA de proposito, sem
              virar `Button`, pra nao competir com "Começar". So Android
              — nao existe API publica de auto-encerramento no iOS.
            */}
            {Platform.OS === 'android' && (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => BackHandler.exitApp()}
                style={styles.sair}
              >
                <Text style={styles.textoSair}>Sair do app</Text>
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
  },
  topo: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.xl,
  },
  cabecalho: {
    marginTop: spacing[6] + spacing[1],
    gap: spacing[3] + 2,
  },
  marca: {
    fontFamily: MONO,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '500',
    letterSpacing: 1.44,
    color: brand.turquesa,
  },
  titulo: {
    fontSize: typography.metric.fontSize,
    lineHeight: 46,
    fontWeight: typography.metric.fontWeight,
    letterSpacing: -1.54,
    color: neutral[0],
  },
  subtitulo: {
    fontSize: typography.body.fontSize,
    lineHeight: 25,
    color: neutral[300],
  },
  promessas: {
    marginTop: spacing[8] + spacing[1],
    gap: spacing[4],
  },
  promessa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 2,
  },
  iconePromessa: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: temaNeutral[800],
  },
  textoPromessa: {
    flex: 1,
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    color: neutral[0],
  },
  espaco: {
    flex: 1,
  },
  rodape: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[1],
    gap: spacing[1] + 2,
  },
  sair: {
    alignSelf: 'center',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  textoSair: {
    color: neutral[300],
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '500',
  },
});
