import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
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
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TOP_APPS = 5;

export default function Perfil() {
  const theme = useTheme();
  const router = useRouter();
  const tempoTela = useTempoTela();
  const { permissions } = useProtectionVerdictContext();

  const [nome, setNome] = useState<string | null>(null);
  const [horas, setHoras] = useState<number | null>(null);
  const [editandoHoras, setEditandoHoras] = useState(false);
  const [desligando, setDesligando] = useState(false);

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

  // Mesma guarda da home antiga: request() substitui pedido pendente em
  // silencio e zera o progresso acumulado, entao um toque duplo custaria a
  // espera inteira de novo.
  const desligarProtecao = () => {
    if (desligando) {
      return;
    }
    setDesligando(true);
    try {
      AceleralockBlocker.requestStopProtection();
      router.push('/esperando');
    } finally {
      setDesligando(false);
    }
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

        <Button
          label="Desligar proteção"
          variant="secondary"
          loading={desligando}
          onPress={desligarProtecao}
        />
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
