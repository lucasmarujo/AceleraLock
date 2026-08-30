import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppIconGrid } from '@/components/AppIconGrid';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { BarrasTempoTela } from '@/components/Onboarding/BarrasTempoTela';
import { useTempoTela } from '@/components/TempoTela/useTempoTela';
import { formatarDuracao, isoLocal } from '@/components/TempoTela/tempoTela';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { readUserName } from '@/state/onboardingStorage';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const DIAS_NO_GRAFICO = 7;
const LETRA_DO_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const tempoTela = useTempoTela();
  const [nome, setNome] = useState<string | null>(null);
  const [bloqueados, setBloqueados] = useState<InstalledApp[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      readUserName()
        .then((salvo) => ativo && setNome(salvo))
        .catch(() => {});

      // Cruza a lista de bloqueados (nativo) com os apps instalados, que e de
      // onde vem icone e rotulo. So a grade precisa disso; a tela de selecao
      // continua sendo a dona da edicao.
      (async () => {
        try {
          const pacotes = new Set(AceleralockBlocker.blockedPackages());
          const apps = await AceleralockBlocker.installedApps();
          if (ativo) {
            setBloqueados(apps.filter((app) => pacotes.has(app.packageName)));
          }
        } catch (error) {
          console.warn('[Home] falha ao montar a grade de bloqueados', error);
          if (ativo) {
            setBloqueados([]);
          }
        }
      })();

      return () => {
        ativo = false;
      };
    }, [])
  );

  const ultimosDias =
    tempoTela.estado === 'pronto' ? ultimosSeteDias(tempoTela.resumo.days) : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={[styles.saudacao, { color: theme.colors.textPrimary }]}>
          {nome ? `Você está protegido, ${nome}.` : 'Você está protegido.'}
        </Text>

        <View style={[styles.cartao, { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault }]}>
          <Text style={[styles.rotulo, { color: theme.colors.textSecondary }]}>Hoje na tela</Text>
          {tempoTela.estado === 'carregando' && <Skeleton width="60%" height={60} />}
          {tempoTela.estado === 'erro' && (
            <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
              Não deu para ler o tempo de tela agora.
            </Text>
          )}
          {tempoTela.estado === 'pronto' && (
            <Text style={[styles.hero, { color: theme.colors.textPrimary }]}>
              {formatarDuracao(tempoTela.resumo.todaySeconds)}
            </Text>
          )}
        </View>

        {tempoTela.estado === 'pronto' &&
          (ultimosDias.length > 0 ? (
            <BarrasTempoTela dados={ultimosDias} legenda="Últimos dias" mostrarValor />
          ) : (
            <EmptyState
              title="Seu histórico começa agora"
              message="A partir de hoje o AceleraLock guarda quanto tempo você passa na tela, e este gráfico se enche sozinho."
            />
          ))}

        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: theme.colors.textPrimary }]}>
            Apps bloqueados
          </Text>

          {bloqueados === null && <Skeleton width="100%" height={44} />}

          {bloqueados !== null &&
            (bloqueados.length > 0 ? (
              <AppIconGrid apps={bloqueados} onPress={() => router.push('/apps')} />
            ) : (
              <EmptyState
                title="Nenhum app bloqueado ainda"
                message="Escolha o primeiro app que rouba seu tempo."
              />
            ))}

          <Button
            label="Escolher apps bloqueados"
            variant="secondary"
            onPress={() => router.push('/apps')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Os sete ultimos dias com leitura, do mais antigo pro mais novo. Dia sem
 * medicao fica de fora em vez de entrar zerado: barra zero afirmaria que a
 * pessoa nao usou o celular num dia que ninguem mediu.
 */
function ultimosSeteDias(days: { date: string; seconds: number }[]) {
  const hoje = isoLocal(new Date());
  return days
    .filter((dia) => dia.date <= hoje)
    .slice(-DIAS_NO_GRAFICO)
    .map((dia) => {
      // 'YYYY-MM-DD' parseado por partes: `new Date('2026-08-30')` seria UTC e
      // poderia cair no dia anterior em fuso negativo.
      const [ano, mes, numero] = dia.date.split('-').map(Number);
      const data = new Date(ano, mes - 1, numero);
      return { rotulo: LETRA_DO_DIA[data.getDay()], horas: dia.seconds / 3600 };
    });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: {
    padding: spacing[6],
    gap: spacing[5],
  },
  saudacao: {
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
  rotulo: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  hero: {
    fontSize: typography.timerHero.fontSize,
    lineHeight: typography.timerHero.lineHeight,
    fontWeight: typography.timerHero.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  secao: {
    gap: spacing[4],
  },
  tituloSecao: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
});
