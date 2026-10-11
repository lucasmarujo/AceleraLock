import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  valor: boolean;
  onChange: (valor: boolean) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  /** `hero`: sobre o cartao de tinta (oferta do modo restrito no onboarding). */
  superficie?: 'padrao' | 'hero';
};

const LARGURA = 52;
const ALTURA = 32;
const BORDA = 2;
const BOTAO_LIGADO = 24;
const BOTAO_DESLIGADO = 16;
/** Medidas a partir de dentro da borda: desligado a 8 da borda externa, ligado a 4 da direita. */
const ESQUERDA_DESLIGADO = 8 - BORDA;
const ESQUERDA_LIGADO = LARGURA - 4 - BOTAO_LIGADO - BORDA;

/**
 * Interruptor no desenho do Paper (Material 3): trilho de 52x32; ligado e
 * preenchido com o botao grande a direita, desligado e so contorno com o botao
 * pequeno a esquerda. O `Switch` do RN muda de cara por plataforma e versao do
 * Android, e o estado desligado dele sumia no tema escuro.
 */
export function Interruptor({
  valor,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  superficie = 'padrao',
}: Props) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const progresso = useSharedValue(valor ? 1 : 0);

  useEffect(() => {
    progresso.value = withTiming(valor ? 1 : 0, {
      duration: reduzido ? 0 : duration.fast,
      easing: Easing.bezier(...easing.standard),
    });
  }, [progresso, reduzido, valor]);

  const hero = superficie === 'hero';
  const trilhoLigado = hero ? theme.colors.textOnHeroBrand : theme.colors.borderBrand;
  const trilhoDesligado = hero ? theme.colors.bgHeroRaised : theme.colors.bgSunken;
  const contorno = hero ? theme.colors.controlOffOnHero : theme.colors.textTertiary;
  const botaoLigado = hero ? theme.colors.bgHero : theme.colors.bgSurface;

  const estiloBotao = useAnimatedStyle(() => {
    const tamanho = BOTAO_DESLIGADO + (BOTAO_LIGADO - BOTAO_DESLIGADO) * progresso.value;
    return {
      width: tamanho,
      height: tamanho,
      borderRadius: tamanho / 2,
      left: ESQUERDA_DESLIGADO + (ESQUERDA_LIGADO - ESQUERDA_DESLIGADO) * progresso.value,
      top: (ALTURA - 2 * BORDA - tamanho) / 2,
    };
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: valor, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!valor)}
      style={[
        styles.trilho,
        {
          backgroundColor: valor ? trilhoLigado : trilhoDesligado,
          borderColor: valor ? trilhoLigado : contorno,
        },
        disabled && styles.desabilitado,
      ]}
    >
      <Animated.View
        style={[styles.botao, estiloBotao, { backgroundColor: valor ? botaoLigado : contorno }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trilho: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radius.full,
    borderWidth: BORDA,
  },
  botao: {
    position: 'absolute',
  },
  desabilitado: {
    opacity: 0.4,
  },
});
