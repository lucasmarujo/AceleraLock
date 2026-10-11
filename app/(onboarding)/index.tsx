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
import {
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

const PROMESSAS: { icone: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  { icone: 'shield-outline', texto: 'Bloqueia os apps e sites que você escolher' },
  { icone: 'hourglass-outline', texto: 'Mudar de ideia pode pedir uma espera' },
  { icone: 'phone-portrait-outline', texto: 'Tudo fica no seu celular. Sem conta.' },
];

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

  const estiloBadge = useEntrada(0, reduzido);
  const estiloTitulo = useEntrada(120, reduzido);
  const estiloPromessas = useEntrada(260, reduzido);
  const estiloCta = useEntrada(400, reduzido);

  return (
    <View style={styles.raiz}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <LinearGradient
        colors={[brand.temaTurquesa, brand.tema]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      {primeiraVez && (
        <SafeAreaView style={styles.conteudo}>
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
            {PROMESSAS.map((promessa) => (
              <View key={promessa.texto} style={styles.promessa}>
                <View style={styles.iconePromessa}>
                  <Ionicons name={promessa.icone} size={18} color={brand.turquesa} />
                </View>
                <Text style={styles.textoPromessa}>{promessa.texto}</Text>
              </View>
            ))}
          </Animated.View>

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
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
    gap: spacing[6],
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.xl,
  },
  cabecalho: {
    gap: spacing[3],
  },
  marca: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 2,
    color: brand.turquesa,
  },
  titulo: {
    fontSize: typography.metric.fontSize,
    lineHeight: typography.metric.lineHeight,
    fontWeight: typography.metric.fontWeight,
    letterSpacing: -1,
    color: neutral[0],
  },
  subtitulo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: neutral[300],
  },
  promessas: {
    gap: spacing[4],
  },
  promessa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconePromessa: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
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
    gap: spacing[2],
  },
  sair: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  textoSair: {
    color: neutral[300],
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '600',
  },
});
