import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import AceleralockBlocker from '@/native/blocker';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ProtectedHome() {
  const theme = useTheme();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  // Reavalia toda vez que esta tela ganha foco (ex.: voltando de
  // esperando.tsx depois de cancelar) — nunca assume que nada mudou so
  // porque o componente ja estava montado.
  useFocusEffect(
    useCallback(() => {
      // protectionActive fica true ate um StopProtection deliberado —
      // force-stop pelo Android mata o servico sem tocar a flag, de
      // proposito (senao "pausado" apareceria pra quem nao pausou). Mas
      // isso significa que so a flag nao basta: sem religar aqui, o
      // servico fica morto e esta tela diz "protegido" com nada rodando —
      // a mesma mentira, so que pela porta que a flag abriu. start() num
      // servico ja vivo cai no onStartCommand da instancia existente, nao
      // recria nada (achado do supervisor, 2026-08-29).
      AceleralockBlocker.start();

      const { pendingTarget } = AceleralockBlocker.protectionState();
      if (pendingTarget) {
        router.replace('/esperando');
      }
    }, [router])
  );

  const handleStopProtection = async () => {
    setRequesting(true);
    try {
      // Se ja existe pedido de STOP_PROTECTION em curso (ex.: a pessoa
      // voltou pra essa tela no meio da espera), NAO chama de novo — hoje
      // request() substitui em silencio e zeraria o progresso acumulado
      // (ver comentario em src/native/blocker.ts). So chama quando nao ha
      // pedido nenhum pendente.
      const { pendingTarget } = AceleralockBlocker.protectionState();
      if (!pendingTarget) {
        AceleralockBlocker.requestStopProtection();
      }
      router.push('/esperando');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[4],
        padding: spacing[6],
        backgroundColor: theme.colors.bgCanvas,
      }}
    >
      <Text
        style={{
          fontSize: typography.title3.fontSize,
          lineHeight: typography.title3.lineHeight,
          fontWeight: typography.title3.fontWeight,
          color: theme.colors.textPrimary,
        }}
      >
        Você está protegido.
      </Text>
      <Button
        label="Desligar proteção"
        variant="secondary"
        loading={requesting}
        onPress={handleStopProtection}
      />
    </View>
  );
}
