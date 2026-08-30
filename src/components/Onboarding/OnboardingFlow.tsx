import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AppListRow, APP_ROW_HEIGHT } from '@/components/AppListRow';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { mergeBlockedPackages } from '@/state/blockedApps';
import { markOnboardingComplete, saveUserName } from '@/state/onboardingStorage';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { nextMissingCorePermission, type CorePermission } from '@/state/verdict';
import { duration, easing, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BarrasTempoTela } from './BarrasTempoTela';
import { SliderHoras } from './SliderHoras';
import {
  HORAS_PADRAO,
  PASSO_ULTIMO,
  TEMPO_TELA_EXEMPLO,
  filtrarApps,
  normalizarNome,
  type Passo,
} from './passos';

/**
 * Intents das duas permissoes essenciais, herdados da tela
 * `(onboarding)/permissoes.tsx` que este fluxo substituiu. Nenhuma das duas
 * tem dialogo de runtime: o CTA abre as Settings e a releitura vem do
 * `AppState 'active'` do `useProtectionVerdict`, que ja resonda sozinho.
 *
 * `Linking.sendIntent` nao carrega data URI, entao a tela de sobreposicao abre
 * na lista geral de apps em vez de ja no AceleraLock: um toque a mais, em
 * troca de nao precisar de funcao nativa nova (e rebuild) so pra montar o
 * `package:` do Intent.
 */
const INTENT: Record<CorePermission, string> = {
  usageAccess: 'android.settings.USAGE_ACCESS_SETTINGS',
  overlay: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
};

async function abrirSettings(permissao: CorePermission) {
  // Fabricante sem a tela do intent cai nos detalhes do proprio app, onde as
  // duas permissoes tambem sao alcancaveis. Nunca falha calado.
  await Linking.sendIntent(INTENT[permissao]).catch(() => Linking.openSettings());
}

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; apps: InstalledApp[] };

type Props = {
  passoInicial: Passo;
  passo: Passo;
  onPasso: (passo: Passo) => void;
};

const APPS_VISIVEIS = 3;

export function OnboardingFlow({ passoInicial, passo, onPasso }: Props) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const { permissions, refresh } = useProtectionVerdictContext();

  const [nome, setNome] = useState('');
  const [horas, setHoras] = useState(HORAS_PADRAO);
  const [busca, setBusca] = useState('');
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [pediuUso, setPediuUso] = useState(false);

  const avancar = (proximo: Passo) => onPasso(proximo);

  // Avanca sozinho SO pra quem saiu daqui pro Settings e voltou tendo
  // concedido — nesse caso pedir mais um toque cobraria duas vezes pela mesma
  // decisao. Quem chega na secao ja com a permissao (reentrada, ou concedida
  // numa instalacao anterior) ve a tela e toca o botao: sem o `pediuUso`, a
  // condicao era verdadeira na montagem e a secao 3 passava batido, que e o
  // que estava acontecendo.
  useEffect(() => {
    if (passo === 3 && pediuUso && permissions?.usageAccess) {
      onPasso(4);
    }
  }, [passo, pediuUso, permissions?.usageAccess, onPasso]);


  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        try {
          const [apps, bloqueados] = await Promise.all([
            AceleralockBlocker.installedApps(),
            Promise.resolve(AceleralockBlocker.blockedPackages()),
          ]);
          if (!ativo) {
            return;
          }
          setMarcados(new Set(bloqueados));
          setCarga({ estado: 'pronto', apps });
        } catch (error) {
          console.warn('[OnboardingFlow] falha ao listar apps', error);
          if (ativo) {
            setCarga({ estado: 'erro' });
          }
        }
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  const alternar = (packageName: string) => {
    const desmarcou = marcados.has(packageName);

    setMarcados((anterior) => {
      const proximo = new Set(anterior);
      if (!proximo.delete(packageName)) {
        proximo.add(packageName);
      }
      return proximo;
    });

    // Fora do updater de proposito: o React pode chamar o updater duas vezes,
    // e abrir Settings e efeito, nao calculo de estado.
    //
    // So ao MARCAR. Aqui a permissao deixa de ser opcional: escolher um app
    // sem as duas concedidas monta uma politica que nada aplica. Desmarcar
    // segue livre e silencioso — mandar alguem pro Settings por desistir de um
    // app seria punir a correcao.
    const pendente = nextMissingCorePermission(permissions);
    if (!desmarcou && pendente) {
      void abrirSettings(pendente);
    }
  };

  const apps = carga.estado === 'pronto' ? carga.apps : [];
  const visiveis = filtrarApps(apps, busca);
  const escolhido = apps.find((app) => marcados.has(app.packageName)) ?? null;

  const criarBloqueio = async () => {
    setSalvando(true);
    try {
      AceleralockBlocker.setBlockedPackages(
        mergeBlockedPackages(
          AceleralockBlocker.blockedPackages(),
          apps.map((app) => app.packageName),
          [...marcados]
        )
      );
      avancar(PASSO_ULTIMO);
    } finally {
      setSalvando(false);
    }
  };

  const finalizar = async () => {
    setSalvando(true);
    try {
      await saveUserName(nome);
      await markOnboardingComplete();
      AceleralockBlocker.start();
      // Quem tira a pessoa do grupo e o veredito reavaliado, nunca um push:
      // empurrar '/' de dentro do onboarding so volta pro primeiro passo.
      await refresh();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <Progresso passo={passo} passoInicial={passoInicial} reduzido={reduzido} />

      <Animated.View
        key={passo}
        style={styles.secao}
        entering={reduzido ? FadeInRight.duration(duration.instant) : FadeInRight.duration(duration.base)}
        exiting={reduzido ? FadeOutLeft.duration(duration.instant) : FadeOutLeft.duration(duration.fast)}
      >
        {passo === 1 && (
          <View style={styles.corpo}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
              Como devemos te chamar?
            </Text>
            <TextField
              value={nome}
              onChangeText={setNome}
              placeholder="seu nome"
              accessibilityLabel="Seu nome"
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => normalizarNome(nome) && avancar(2)}
            />
            <View style={styles.espacador} />
            <Button label="Avançar" disabled={!normalizarNome(nome)} onPress={() => avancar(2)} />
          </View>
        )}

        {passo === 2 && (
          <View style={styles.corpo}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
              Quanto tempo você está gastando no celular todos os dias?
            </Text>
            <View style={styles.numeroCaixa}>
              <Text style={[styles.numero, { color: theme.colors.textBrand }]}>{horas}</Text>
              <Text style={[styles.unidade, { color: theme.colors.textSecondary }]}>
                {horas === 1 ? 'hora por dia' : 'horas por dia'}
              </Text>
            </View>
            <SliderHoras horas={horas} onChange={setHoras} />
            <View style={styles.espacador} />
            <Button label="Avançar" onPress={() => avancar(3)} />
          </View>
        )}

        {passo === 3 && (
          <View style={styles.corpo}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
              Agora, deixe-nos descobrir seu tempo atual de tela
            </Text>
            <BarrasTempoTela
              dados={TEMPO_TELA_EXEMPLO}
              legenda="Exemplo — libere o acesso ao uso para ver o seu"
            />
            <View style={styles.espacador} />
            <Button
              label="Dar permissão"
              onPress={() => {
                // Ja concedida: o toque e so o aceite explicito de seguir. Nao
                // manda pro Settings — abrir uma tela que nao tem nada pra
                // fazer seria passo morto.
                if (permissions?.usageAccess) {
                  avancar(4);
                  return;
                }
                setPediuUso(true);
                void abrirSettings('usageAccess');
              }}
            />
            <Text
              accessibilityRole="button"
              onPress={() => avancar(4)}
              style={[styles.linkDiscreto, { color: theme.colors.textTertiary }]}
            >
              Continuar sem dar a permissão
            </Text>
          </View>
        )}

        {passo === 4 && (
          <View style={styles.corpo}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
              {nome ? `${nome}, vamos criar seu primeiro bloqueio!` : 'Vamos criar seu primeiro bloqueio!'}
            </Text>

            <View
              style={[
                styles.cartao,
                { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
              ]}
            >
              <TextField
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar app"
                accessibilityLabel="Buscar app pelo nome"
                autoCapitalize="none"
              />

              {carga.estado === 'carregando' && (
                <View style={styles.listaFeedback}>
                  {[0, 1, 2].map((linha) => (
                    <Skeleton key={linha} width="100%" height={APP_ROW_HEIGHT} />
                  ))}
                </View>
              )}

              {carga.estado === 'erro' && (
                <Text style={[styles.corpoTexto, { color: theme.colors.textSecondary }]}>
                  Não deu para ler a lista de apps do aparelho. Saia e entre nesta tela para tentar
                  de novo.
                </Text>
              )}

              {carga.estado === 'pronto' && (
                // Altura travada em 3 linhas: a lista rola por dentro em vez de
                // empurrar o CTA pra fora da tela quando o teclado abre.
                <View style={styles.lista}>
                  <ScrollView
                    contentContainerStyle={styles.listaConteudo}
                    keyboardShouldPersistTaps="handled"
                  >
                    {visiveis.length === 0 ? (
                      <Text style={[styles.corpoTexto, { color: theme.colors.textSecondary }]}>
                        Nenhum app com esse nome.
                      </Text>
                    ) : (
                      visiveis.map((app) => (
                        <AppListRow
                          key={app.packageName}
                          app={app}
                          marcado={marcados.has(app.packageName)}
                          onToggle={() => alternar(app.packageName)}
                        />
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.espacador} />
            <Button
              label="Criar bloqueio"
              loading={salvando}
              disabled={marcados.size === 0 || !permissions?.coreGranted}
              onPress={criarBloqueio}
            />
            {marcados.size > 0 && !permissions?.coreGranted && (
              <Text style={[styles.linkDiscreto, { color: theme.colors.textSecondary }]}>
                Falta liberar as permissões para o bloqueio funcionar.
              </Text>
            )}
          </View>
        )}

        {passo === PASSO_ULTIMO && (
          <View style={styles.corpo}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>Voa lá</Text>
            <CartaoBloqueado app={escolhido} reduzido={reduzido} />
            <View style={styles.espacador} />
            <Button label="Finalizar!" loading={salvando} onPress={finalizar} />
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function Progresso({
  passo,
  passoInicial,
  reduzido,
}: {
  passo: Passo;
  passoInicial: Passo;
  reduzido: boolean;
}) {
  const theme = useTheme();
  // A barra mede o caminho que esta pessoa percorre. Quem entra na secao 3 por
  // reentrada nao "comeca com 40% feito" — comeca do zero do proprio caminho.
  const total = PASSO_ULTIMO - passoInicial + 1;
  const feito = (passo - passoInicial + 1) / total;
  const progresso = useSharedValue(feito);

  useEffect(() => {
    progresso.value = withTiming(feito, {
      duration: reduzido ? duration.instant : duration.base,
      easing: Easing.bezier(...easing.standard),
    });
  }, [feito, progresso, reduzido]);

  const estilo = useAnimatedStyle(() => ({ width: `${progresso.value * 100}%` }));

  return (
    <View
      style={[styles.trilhaProgresso, { backgroundColor: theme.colors.bgSunken }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: passo - passoInicial + 1 }}
    >
      <Animated.View
        style={[styles.progresso, estilo, { backgroundColor: theme.colors.borderBrand }]}
      />
    </View>
  );
}

function CartaoBloqueado({ app, reduzido }: { app: InstalledApp | null; reduzido: boolean }) {
  const theme = useTheme();
  const entrada = useSharedValue(reduzido ? 1 : 0);

  useEffect(() => {
    entrada.value = reduzido
      ? 1
      : withSpring(1, { damping: 14, stiffness: 140, mass: 0.6 });
  }, [entrada, reduzido]);

  const estilo = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ scale: 0.85 + entrada.value * 0.15 }],
  }));

  return (
    <Animated.View
      style={[
        styles.cartao,
        styles.cartaoFinal,
        estilo,
        { backgroundColor: theme.colors.bgBrandSubtle, borderColor: theme.colors.borderBrand },
      ]}
    >
      {app?.iconUri ? (
        <Image
          source={{ uri: app.iconUri }}
          style={styles.iconeFinal}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.iconeFinal, { backgroundColor: theme.colors.bgSunken }]} />
      )}
      <Text style={[styles.tituloFinal, { color: theme.colors.textPrimary }]}>
        Aplicativo bloqueado!
      </Text>
      {app && (
        <Text style={[styles.corpoTexto, { color: theme.colors.textSecondary }]}>{app.label}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing[6],
    gap: spacing[5],
  },
  trilhaProgresso: {
    height: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progresso: {
    height: '100%',
    borderRadius: radius.full,
  },
  secao: {
    flex: 1,
  },
  corpo: {
    flex: 1,
    gap: spacing[4],
  },
  espacador: {
    flex: 1,
  },
  titulo: {
    fontSize: typography.title1.fontSize,
    lineHeight: typography.title1.lineHeight,
    fontWeight: typography.title1.fontWeight,
  },
  corpoTexto: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  numeroCaixa: {
    alignItems: 'center',
    gap: spacing[1],
  },
  numero: {
    fontSize: typography.timerHero.fontSize,
    lineHeight: typography.timerHero.lineHeight,
    fontWeight: typography.timerHero.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  unidade: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
  linkDiscreto: {
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  lista: {
    height: APP_ROW_HEIGHT * APPS_VISIVEIS + spacing[3] * (APPS_VISIVEIS - 1),
  },
  listaConteudo: {
    gap: spacing[3],
  },
  listaFeedback: {
    gap: spacing[3],
  },
  cartaoFinal: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  iconeFinal: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  tituloFinal: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: typography.title2.fontWeight,
    textAlign: 'center',
  },
});
