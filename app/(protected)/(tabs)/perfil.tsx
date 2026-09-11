import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { Skeleton } from '@/components/Skeleton';
import { SliderHoras } from '@/components/Onboarding/SliderHoras';
// Mantido importado de proposito junto com o bloco comentado abaixo.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CalendarioTempoTela } from '@/components/TempoTela/CalendarioTempoTela';
import { formatarDuracao } from '@/components/TempoTela/tempoTela';
import { useTempoTela } from '@/components/TempoTela/useTempoTela';
import AceleralockBlocker from '@/native/blocker';
import { readDailyHours, readUserName, saveDailyHours } from '@/state/onboardingStorage';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { PREFERENCIAS, ROTULOS_PREFERENCIA } from '@/theme/preferenciaTema';
import { useThemePreference } from '@/theme/ThemePreferenceContext';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TOP_APPS = 5;

export default function Perfil() {
  const theme = useTheme();
  const tempoTela = useTempoTela();
  const { permissions, restricted, refresh } = useProtectionVerdictContext();
  const { preferencia, definirPreferencia } = useThemePreference();
  const router = useRouter();

  const [nome, setNome] = useState<string | null>(null);
  const [horas, setHoras] = useState<number | null>(null);
  const [editandoHoras, setEditandoHoras] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.all([readUserName(), readDailyHours()])
        .then(([nomeSalvo, horasSalvas]) => {
          if (ativo) {
            setNome(nomeSalvo);
            setHoras(horasSalvas);
          }
        })
        .catch(() => {});
      return () => {
        ativo = false;
      };
    }, [])
  );

  const alterarHoras = (valor: number) => {
    setHoras(valor);
    void saveDailyHours(valor);
  };

  /**
   * Ativar e imediato (compromisso com o futuro). Desativar pede 30min via
   * WaitingPeriod — a confirmacao do Alert nao e a espera, e so um momento
   * de respiro antes de abrir o pedido (e para o caso da pessoa tocar sem
   * querer). O pedido em si vai pela mesma porta de `requestStopProtection`.
   */
  const alternarModoRestrito = () => {
    if (!restricted) {
      AceleralockBlocker.setRestricted(true);
      void refresh();
      return;
    }
    Alert.alert(
      'Desativar modo restrito?',
      'Você vai precisar esperar 30 minutos antes da desativação valer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar espera',
          onPress: () => {
            if (AceleralockBlocker.requestDisableRestricted()) {
              router.push('/esperando');
            }
          },
        },
      ]
    );
  };

  const topApps =
    tempoTela.estado === 'pronto' ? tempoTela.resumo.byPackage.slice(0, TOP_APPS) : [];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.cabecalho}>
          <Avatar nome={nome} />
          <Text style={[styles.nome, { color: theme.colors.textPrimary }]}>
            {nome ?? 'Sem nome'}
          </Text>
        </View>

        <View
          style={[
            styles.cartao,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <ListRow
            label="Tempo que você estimou"
            value={horas === null ? '—' : horas === 1 ? '1 hora por dia' : `${horas} horas por dia`}
            accessory={
              <Text
                accessibilityRole="button"
                onPress={() => setEditandoHoras((atual) => !atual)}
                style={[styles.link, { color: theme.colors.textBrand }]}
              >
                {editandoHoras ? 'Pronto' : 'Editar'}
              </Text>
            }
          />
          {editandoHoras && <SliderHoras horas={horas ?? 1} onChange={alterarHoras} />}
        </View>

        <View
          style={[
            styles.cartao,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <Text style={[styles.rotulo, { color: theme.colors.textSecondary }]}>Hoje na tela</Text>
          {tempoTela.estado === 'carregando' && <Skeleton width="60%" height={40} />}
          {tempoTela.estado === 'erro' && (
            <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
              Não deu para ler o tempo de tela agora.
            </Text>
          )}
          {tempoTela.estado === 'pronto' && (
            <Text style={[styles.total, { color: theme.colors.textPrimary }]}>
              {formatarDuracao(tempoTela.resumo.todaySeconds)}
            </Text>
          )}
        </View>

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>
            O que mais consumiu hoje
          </Text>
          {tempoTela.estado === 'carregando' && <Skeleton width="100%" height={48} />}
          {tempoTela.estado === 'pronto' &&
            (topApps.length > 0 ? (
              topApps.map((app) => (
                <ListRow
                  key={app.packageName}
                  label={app.label}
                  value={formatarDuracao(app.seconds)}
                  icon={
                    app.iconUri ? (
                      <Image
                        source={{ uri: app.iconUri }}
                        style={styles.icone}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={[styles.icone, { backgroundColor: theme.colors.bgSunken }]} />
                    )
                  }
                />
              ))
            ) : (
              <EmptyState
                title="Nada registrado hoje"
                message="Assim que você usar o celular, os apps aparecem aqui."
              />
            ))}
        </View>

        {/*
          Calendario do mes fora de vista por decisao de produto (2026-08-30),
          nao por defeito: o componente, os testes e a coleta que o alimenta
          continuam de pe. Para trazer de volta, basta descomentar — nada mais
          precisa mudar, porque `days` ja traz o historico inteiro.

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>
            {mesPorExtenso(new Date())}
          </Text>
          {tempoTela.estado === 'pronto' && (
            <CalendarioTempoTela ancora={new Date()} leituras={tempoTela.resumo.days} />
          )}
          <Text style={[styles.nota, { color: theme.colors.textTertiary }]}>
            Dias em branco são dias sem medição — o histórico começa quando você instala o app.
          </Text>
        </View>
        */}

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>
            Modo restrito
          </Text>
          <View
            style={[
              styles.cartao,
              { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
            ]}
          >
            <ListRow
              label={
                restricted
                  ? 'Modo restrito está ativo. A lista de apps não pode ser editada.'
                  : 'Bloqueia a edição da lista de apps enquanto estiver ativo.'
              }
              value={restricted ? 'Ativo' : 'Desativado'}
              emphasis={restricted ? 'brand' : 'default'}
              accessory={
                <Text
                  accessibilityRole="button"
                  onPress={alternarModoRestrito}
                  style={[styles.link, { color: theme.colors.textBrand }]}
                >
                  {restricted ? 'Desativar' : 'Ativar'}
                </Text>
              }
            />
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>Aparência</Text>
          <View
            style={[
              styles.cartao,
              { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
            ]}
          >
            {PREFERENCIAS.map((opcao) => (
              <ListRow
                key={opcao}
                label={ROTULOS_PREFERENCIA[opcao]}
                value={preferencia === opcao ? 'Ativo' : undefined}
                emphasis="brand"
                selected={preferencia === opcao}
                onPress={() => definirPreferencia(opcao)}
              />
            ))}
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>Permissões</Text>
          <View
            style={[
              styles.cartao,
              { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
            ]}
          >
            <ListRow
              label="Acesso ao uso"
              value={permissions?.usageAccess ? 'Concedida' : 'Pendente'}
              emphasis={permissions?.usageAccess ? 'brand' : 'danger'}
            />
            <ListRow
              label="Sobrepor outros apps"
              value={permissions?.overlay ? 'Concedida' : 'Pendente'}
              emphasis={permissions?.overlay ? 'brand' : 'danger'}
            />
            <ListRow
              label="Bateria sem otimização"
              value={permissions?.batteryExempt ? 'Sim' : 'Não'}
            />
            <ListRow
              label="Notificações"
              value={permissions?.notifications ? 'Ativadas' : 'Desativadas'}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Usada so pelo calendario, que esta comentado acima. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mesPorExtenso(data: Date): string {
  const nome = data.toLocaleDateString('pt-BR', { month: 'long' });
  return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: {
    padding: spacing[6],
    gap: spacing[5],
  },
  cabecalho: {
    alignItems: 'center',
    gap: spacing[3],
  },
  nome: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: typography.title2.fontWeight,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[1],
  },
  secao: {
    gap: spacing[3],
  },
  tituloSecao: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  rotulo: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  total: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  nota: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  link: {
    fontSize: typography.callout.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  icone: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
});
