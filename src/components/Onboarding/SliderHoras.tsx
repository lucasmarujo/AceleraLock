import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  HORAS_MAX,
  HORAS_MIN,
  horasDaProporcao,
  proporcaoDasHoras,
  proporcaoDoToque,
} from './passos';

type Props = {
  horas: number;
  onChange: (horas: number) => void;
};

const TRILHA_ALTURA = 6;
const THUMB = 28;

/**
 * Slider de 1 a 12 com `PanResponder` do proprio RN: o app tem gesture-handler
 * instalado, mas nao monta `GestureHandlerRootView` em lugar nenhum — um
 * arrasto horizontal simples nao paga esse custo de setup.
 *
 * **Duas grandezas, nao uma.** O thumb e o preenchimento seguem a posicao
 * *continua* do dedo (`proporcao`, um shared value); so o numero exibido
 * arredonda. Amarrar a posicao a hora arredondada — que era como estava — faz
 * o thumb ter apenas 12 paradas possiveis, e o arrasto vira pulo de pixel a
 * cada degrau. Ao soltar, a posicao assenta na hora escolhida com um timing
 * curto: durante o arrasto o dedo manda, e no fim o valor real e que manda.
 *
 * A posicao mora em shared value e nao em estado do React pra que o arrasto
 * nao dependa de re-render: o `setState` do numero acontece no maximo 12 vezes,
 * quando o degrau muda de verdade.
 */
export function SliderHoras({ horas, onChange }: Props) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const [largura, setLargura] = useState(0);
  const larguraRef = useRef(0);
  // O PanResponder e criado uma vez; sem refs ele congelaria o primeiro
  // `onChange` e a largura ainda nao medida pelo layout.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const horasRef = useRef(horas);
  const offsetRef = useRef(0);
  const arrastandoRef = useRef(false);

  const proporcao = useSharedValue(proporcaoDasHoras(horas));
  const pulo = useSharedValue(1);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evento, gesto) => {
          arrastandoRef.current = true;
          // x0 e absoluto na tela e locationX e relativo a trilha: a diferenca
          // e a origem da trilha, que o onLayout nao entrega.
          offsetRef.current = gesto.x0 - evento.nativeEvent.locationX;
          aplicar(evento.nativeEvent.locationX);
        },
        onPanResponderMove: (_evento, gesto) => {
          aplicar(gesto.moveX - offsetRef.current);
        },
        onPanResponderRelease: assentar,
        onPanResponderTerminate: assentar,
      }),
    []
  );

  function aplicar(x: number) {
    const posicao = proporcaoDoToque(x, larguraRef.current);
    proporcao.value = posicao;

    const novasHoras = horasDaProporcao(posicao);
    if (novasHoras !== horasRef.current) {
      horasRef.current = novasHoras;
      onChangeRef.current(novasHoras);
    }
  }

  function assentar() {
    arrastandoRef.current = false;
    proporcao.value = withTiming(proporcaoDasHoras(horasRef.current), {
      duration: duration.fast,
      easing: Easing.bezier(...easing.standard),
    });
  }

  // Mudanca vinda de fora (as acoes de acessibilidade) move o thumb sozinha.
  // Durante o arrasto nao: o dedo ja e a fonte da posicao, e escrever por cima
  // dele brigaria com o gesto.
  useEffect(() => {
    horasRef.current = horas;
    if (arrastandoRef.current) {
      return;
    }
    const alvo = proporcaoDasHoras(horas);
    proporcao.value = reduzido
      ? alvo
      : withTiming(alvo, {
          duration: duration.fast,
          easing: Easing.bezier(...easing.standard),
        });
  }, [horas, proporcao, reduzido]);

  useEffect(() => {
    if (reduzido) {
      return;
    }
    pulo.value = withSequence(
      withTiming(1.08, { duration: duration.instant, easing: Easing.bezier(...easing.standard) }),
      withTiming(1, { duration: duration.fast, easing: Easing.bezier(...easing.standard) })
    );
  }, [horas, pulo, reduzido]);

  const estiloPreenchimento = useAnimatedStyle(() => ({
    width: `${proporcao.value * 100}%`,
  }));

  const estiloThumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: proporcao.value * largura - THUMB / 2 },
      { scale: pulo.value },
    ],
  }));

  return (
    <View
      style={styles.area}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Horas por dia no celular"
      accessibilityValue={{ min: HORAS_MIN, max: HORAS_MAX, now: horas }}
      // Sem estas acoes o controle so existe pra quem consegue arrastar.
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(evento) => {
        if (evento.nativeEvent.actionName === 'increment') {
          onChange(Math.min(HORAS_MAX, horas + 1));
        } else if (evento.nativeEvent.actionName === 'decrement') {
          onChange(Math.max(HORAS_MIN, horas - 1));
        }
      }}
      onLayout={(evento) => {
        const medida = evento.nativeEvent.layout.width;
        larguraRef.current = medida;
        setLargura(medida);
      }}
      {...responder.panHandlers}
    >
      <View style={[styles.trilha, { backgroundColor: theme.colors.bgSunken }]}>
        <Animated.View
          style={[
            styles.preenchimento,
            estiloPreenchimento,
            { backgroundColor: theme.colors.borderBrand },
          ]}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          estiloThumb,
          {
            backgroundColor: theme.colors.borderBrand,
            borderColor: theme.colors.bgSurface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    alignSelf: 'stretch',
    height: THUMB + spacing[4],
    justifyContent: 'center',
  },
  trilha: {
    height: TRILHA_ALTURA,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  preenchimento: {
    height: '100%',
    borderRadius: radius.full,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.full,
    borderWidth: 3,
  },
});
