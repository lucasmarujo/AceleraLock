import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { AppListRow, APP_ROW_HEIGHT } from '@/components/AppListRow';
import { Button } from '@/components/Button';
import { HeroCard } from '@/components/HeroCard';
import { IconeApp } from '@/components/IconeApp';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { mergeBlockedPackages } from '@/state/blockedApps';
import { markOnboardingComplete, saveDailyHours, saveUserName } from '@/state/onboardingStorage';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { type CorePermission } from '@/state/verdict';
import { duration, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BarrasTempoTela } from './BarrasTempoTela';
import { SliderHoras } from './SliderHoras';
import {
  HORAS_ATALHOS,
  HORAS_MAX,
  HORAS_MIN,
  HORAS_PADRAO,
  PASSO_ULTIMO,
  TEMPO_TELA_EXEMPLO,
  filtrarApps,
  legendaDaConclusao,
  normalizarNome,
  permissoesFaltando,
  progressoDoPasso,
  rotuloDoBloqueio,
  textoOfertaRestrito,
  tituloDaConclusao,
  tituloPermissoesFaltando,
  type Passo,
} from './passos';

/**
 * Intents das duas permissoes essenciais (Android). No iOS, Family Controls
 * usa um dialog de runtime via AuthorizationCenter — a autorizacao e pedida
 * diretamente pela funcao start() do modulo nativo, nao via Settings.
 */
const INTENT: Record<CorePermission, string> = {
  usageAccess: 'android.settings.USAGE_ACCESS_SETTINGS',
  overlay: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
};

const ROTULO_PERMISSAO: Record<CorePermission, string> = {
  usageAccess: 'Acesso ao uso',
  overlay: 'Sobrepor outros apps',
};

async function abrirSettings(permissao: CorePermission) {
  if (Platform.OS === 'ios') {
    // No iOS, Family Controls e autorizado via dialog do sistema, disparado
    // pelo start() do modulo nativo. Abrir Settings genericas como fallback.
    await Linking.openSettings();
    return;
  }
  await Linking.sendIntent(INTENT[permissao]).catch(() => Linking.openSettings());
}

type Carga =
  { estado: 'carregando' } | { estado: 'erro' } | { estado: 'pronto'; apps: InstalledApp[] };

type Props = {
  passoInicial: Passo;
  passo: Passo;
  onPasso: (passo: Passo) => void;
  /** `null` quando nao ha para onde voltar (reentrada sem historico). */
  onVoltar: (() => void) | null;
};

const APPS_VISIVEIS = 3;

const O_QUE_A_PERMISSAO_VE: { icone: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  { icone: 'checkmark-circle-outline', texto: 'Vê quanto tempo cada app ficou aberto.' },
  { icone: 'close-circle-outline', texto: 'Não vê o que você faz dentro deles.' },
  { icone: 'phone-portrait-outline', texto: 'Nada sai do seu celular.' },
];

export function OnboardingFlow({ passoInicial, passo, onPasso, onVoltar }: Props) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const { permissions, restricted, refresh } = useProtectionVerdictContext();

  const [nome, setNome] = useState('');
  const [horas, setHoras] = useState(HORAS_PADRAO);
  const [busca, setBusca] = useState('');
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [pediuUso, setPediuUso] = useState(false);
  const [ligarRestrito, setLigarRestrito] = useState(false);

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

  // Marcar e desmarcar sao livres. Antes, marcar sem as duas permissoes abria
  // o Settings no meio da escolha; agora o checklist acima da lista diz o que
  // falta e o CTA so libera com as duas concedidas — o pedido e explicito, nao
  // efeito colateral de tocar num app.
  const alternar = (packageName: string) => {
    setMarcados((anterior) => {
      const proximo = new Set(anterior);
      if (!proximo.delete(packageName)) {
        proximo.add(packageName);
      }
      return proximo;
    });
  };

  const apps = carga.estado === 'pronto' ? carga.apps : [];
  const visiveis = filtrarApps(apps, busca);
  const escolhidos = apps.filter((app) => marcados.has(app.packageName));
  const faltando = permissoesFaltando(permissions);
  const { atual, total } = progressoDoPasso(passo, passoInicial);

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
      // Ate agora a estimativa era coletada e descartada: nao havia nada que a
      // lesse. Ajustes passou a mostra-la (e a deixar corrigir), entao ela
      // vira dado gravado.
      await saveDailyHours(horas);
      await markOnboardingComplete();
      // Ligar e imediato em qualquer lugar do app; aqui so espera o "Ir para o
      // inicio" pra que o interruptor possa ser desfeito sem custo ate la.
      if (ligarRestrito && !restricted) {
        AceleralockBlocker.setRestricted(true);
      }
      AceleralockBlocker.start();
      // Quem tira a pessoa do grupo e o veredito reavaliado, nunca um push:
      // empurrar '/' de dentro do onboarding so volta pro primeiro passo.
      await refresh();
    } finally {
      setSalvando(false);
    }
  };

  let titulo: string;
  let subtitulo: string;
  let conteudo: ReactNode;
  let rodape: ReactNode;

  switch (passo) {
    case 1:
      titulo = 'Como você quer ser chamado?';
      subtitulo = 'Só para o app te cumprimentar.';
      conteudo = (
        <TextField
          label="Seu nome"
          value={nome}
          onChangeText={setNome}
          placeholder="seu nome"
          accessibilityLabel="Seu nome"
          helper="Fica salvo só neste celular."
          autoFocus
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => normalizarNome(nome) && avancar(2)}
        />
      );
      rodape = (
        <Button label="Continuar" disabled={!normalizarNome(nome)} onPress={() => avancar(2)} />
      );
      break;

    case 2:
      titulo = 'Quanto tempo de tela você acha que tem por dia?';
      subtitulo = 'Um chute honesto. Depois o app compara com o real.';
      conteudo = (
        <>
          <View style={[styles.cartao, cartaoNeutro(theme), styles.cartaoHoras]}>
            <View style={styles.numeroCaixa}>
              <Text style={[styles.numero, { color: theme.colors.textBrand }]}>{horas}</Text>
              <Text style={[styles.unidade, { color: theme.colors.textSecondary }]}>
                {horas === 1 ? 'hora por dia' : 'horas por dia'}
              </Text>
            </View>
            <SliderHoras horas={horas} onChange={setHoras} />
            <View style={styles.escala}>
              <Text style={[styles.textoEscala, { color: theme.colors.textTertiary }]}>
                {HORAS_MIN} h
              </Text>
              <Text style={[styles.textoEscala, { color: theme.colors.textTertiary }]}>
                {HORAS_MAX} h
              </Text>
            </View>
          </View>
          <View style={styles.atalhos}>
            <Text style={[styles.rotuloAtalhos, { color: theme.colors.textSecondary }]}>
              Ou toque num valor:
            </Text>
            <View style={styles.linhaAtalhos}>
              {HORAS_ATALHOS.map((valor) => {
                const ativo = valor === horas;
                return (
                  <Pressable
                    key={valor}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo }}
                    accessibilityLabel={`${valor} horas por dia`}
                    onPress={() => setHoras(valor)}
                    style={[
                      styles.chip,
                      ativo
                        ? {
                            backgroundColor: theme.colors.bgBrandSubtle,
                            borderColor: theme.colors.borderBrand,
                          }
                        : {
                            backgroundColor: theme.colors.bgSurface,
                            borderColor: theme.colors.borderDefault,
                          },
                    ]}
                  >
                    {ativo && (
                      <Ionicons name="checkmark" size={16} color={theme.colors.textBrand} />
                    )}
                    <Text
                      style={[
                        styles.textoChip,
                        { color: ativo ? theme.colors.textBrand : theme.colors.textPrimary },
                      ]}
                    >
                      {valor} h
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      );
      rodape = <Button label="Continuar" onPress={() => avancar(3)} />;
      break;

    case 3:
      titulo = 'Vamos medir seu tempo de tela real';
      subtitulo =
        Platform.OS === 'ios'
          ? 'Para isso, o iPhone pede a sua autorização.'
          : 'Para isso, o Android pede a permissão de acesso ao uso.';
      conteudo = (
        <>
          <View style={[styles.cartao, cartaoNeutro(theme)]}>
            <View style={styles.cabecalhoExemplo}>
              <Text style={[styles.tituloCartao, { color: theme.colors.textPrimary }]}>
                O que você vai ver
              </Text>
              <View style={[styles.selo, { backgroundColor: theme.colors.bgSunken }]}>
                <Text style={[styles.textoSelo, { color: theme.colors.textSecondary }]}>
                  EXEMPLO
                </Text>
              </View>
            </View>
            <BarrasTempoTela
              dados={TEMPO_TELA_EXEMPLO.map((dado, indice) => ({
                ...dado,
                destaque: indice === TEMPO_TELA_EXEMPLO.length - 1,
              }))}
              legenda="Exemplo — libere o acesso ao uso para ver o seu"
            />
          </View>
          <View style={[styles.cartao, cartaoNeutro(theme)]}>
            {O_QUE_A_PERMISSAO_VE.map((item) => (
              <View key={item.texto} style={styles.itemLista}>
                <Ionicons
                  name={item.icone}
                  size={20}
                  color={
                    item.icone === 'checkmark-circle-outline'
                      ? theme.colors.textBrand
                      : theme.colors.textSecondary
                  }
                />
                <Text style={[styles.textoItem, { color: theme.colors.textPrimary }]}>
                  {item.texto}
                </Text>
              </View>
            ))}
          </View>
        </>
      );
      rodape = (
        <>
          <Button
            label={permissions?.usageAccess ? 'Continuar' : 'Liberar acesso ao uso'}
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
          {!permissions?.usageAccess && (
            <Button label="Agora não" variant="ghost" onPress={() => avancar(4)} />
          )}
        </>
      );
      break;

    case 4:
      titulo = nome ? `${nome}, o que você quer bloquear?` : 'O que você quer bloquear?';
      subtitulo = 'Escolha pelo menos um app. Dá para mudar depois.';
      conteudo = (
        <>
          {faltando.length > 0 && (
            <View
              style={[
                styles.cartao,
                {
                  backgroundColor: theme.colors.bgWarningSubtle,
                  borderColor: theme.colors.borderWarning,
                },
              ]}
            >
              <Text style={[styles.tituloCartao, { color: theme.colors.textWarning }]}>
                {tituloPermissoesFaltando(faltando.length)}
              </Text>
              {(['usageAccess', 'overlay'] as const).map((chave) => {
                const concedida = !faltando.includes(chave);
                return (
                  <View key={chave} style={styles.linhaPermissao}>
                    <Ionicons
                      name={concedida ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={20}
                      color={concedida ? theme.colors.textBrand : theme.colors.iconWarning}
                    />
                    <Text style={[styles.textoItem, { color: theme.colors.textPrimary }]}>
                      {ROTULO_PERMISSAO[chave]}
                    </Text>
                    {concedida ? (
                      <Text style={[styles.pronto, { color: theme.colors.textBrand }]}>Pronto</Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Liberar ${ROTULO_PERMISSAO[chave]}`}
                        hitSlop={4}
                        onPress={() => void abrirSettings(chave)}
                        style={({ pressed }) => [
                          styles.liberar,
                          {
                            backgroundColor: pressed
                              ? theme.colors.surfaces.brand.pressedFill
                              : theme.colors.surfaces.brand.fill,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.textoLiberar,
                            { color: theme.colors.surfaces.brand.onFill },
                          ]}
                        >
                          Liberar
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <TextField
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar app"
            accessibilityLabel="Buscar app pelo nome"
            leadingIcon="search"
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
              Não deu para ler a lista de apps do aparelho. Saia e entre nesta tela para tentar de
              novo.
            </Text>
          )}

          {carga.estado === 'pronto' && (
            // Altura travada em 3 linhas: a lista rola por dentro em vez de
            // empurrar o CTA pra fora da tela quando o teclado abre.
            <View style={[styles.lista, cartaoNeutro(theme)]}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {visiveis.length === 0 ? (
                  <Text
                    style={[
                      styles.corpoTexto,
                      styles.semResultado,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Nenhum app com esse nome.
                  </Text>
                ) : (
                  visiveis.map((app, indice) => (
                    <View
                      key={app.packageName}
                      style={
                        indice > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.colors.borderDefault,
                        }
                      }
                    >
                      <AppListRow
                        app={app}
                        marcado={marcados.has(app.packageName)}
                        onToggle={() => alternar(app.packageName)}
                        variante="check"
                      />
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </>
      );
      rodape = (
        <>
          <Button
            label={rotuloDoBloqueio(marcados.size)}
            loading={salvando}
            disabled={marcados.size === 0 || !permissions?.coreGranted}
            onPress={criarBloqueio}
          />
          {marcados.size > 0 && faltando.length > 0 && (
            <Text style={[styles.legendaRodape, { color: theme.colors.textSecondary }]}>
              {faltando.length === 1
                ? 'Libere a permissão acima para continuar.'
                : 'Libere as permissões acima para continuar.'}
            </Text>
          )}
        </>
      );
      break;

    case 5: {
      const rotulos = escolhidos.map((app) => app.label);
      const { waitMinutes } = AceleralockBlocker.protectionState();
      titulo = tituloDaConclusao(rotulos);
      subtitulo = 'Quando bater a vontade de abrir, o AceleraLock fica no caminho.';
      conteudo = (
        <>
          <CartaoBloqueado
            app={escolhidos[0] ?? null}
            total={escolhidos.length}
            reduzido={reduzido}
          />
          {!restricted && (
            <View style={styles.oferta}>
              <HeroCard style={styles.hero}>
                <View style={styles.cabecalhoOferta}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.colors.textOnHeroFriction}
                  />
                  <Text style={[styles.tituloOferta, { color: theme.colors.textOnHero }]}>
                    Modo restrito
                  </Text>
                  <View style={[styles.selo, { backgroundColor: theme.colors.bgHeroRaised }]}>
                    <Text style={[styles.textoSelo, { color: theme.colors.textOnHeroFriction }]}>
                      RECOMENDADO
                    </Text>
                  </View>
                </View>
                <Text style={[styles.corpoOferta, { color: theme.colors.textOnHeroSecondary }]}>
                  {textoOfertaRestrito(rotulos, waitMinutes)}
                </Text>
                <View style={[styles.divisoria, { backgroundColor: theme.colors.borderHero }]} />
                <View style={styles.linhaInterruptor}>
                  <Text style={[styles.rotuloInterruptor, { color: theme.colors.textOnHero }]}>
                    Ligar modo restrito
                  </Text>
                  <Switch
                    accessibilityLabel="Ligar modo restrito"
                    value={ligarRestrito}
                    onValueChange={setLigarRestrito}
                    trackColor={{
                      false: theme.colors.bgHeroRaised,
                      true: theme.colors.textOnHeroBrand,
                    }}
                    thumbColor={theme.colors.textOnHero}
                  />
                </View>
              </HeroCard>
              <Text style={[styles.legendaOferta, { color: theme.colors.textSecondary }]}>
                Ligar é imediato. Dá para mudar depois em Bloqueios.
              </Text>
            </View>
          )}
        </>
      );
      rodape = <Button label="Ir para o início" loading={salvando} onPress={finalizar} />;
      break;
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <View style={styles.cabecalho}>
        {onVoltar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={4}
            onPress={onVoltar}
            style={styles.voltar}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.voltar} />
        )}
        <View
          style={styles.segmentos}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Passo ${atual} de ${total}`}
          accessibilityValue={{ min: 1, max: total, now: atual }}
        >
          {Array.from({ length: total }, (_, indice) => (
            <View
              key={indice}
              style={[
                styles.segmento,
                {
                  backgroundColor:
                    indice < atual ? theme.colors.borderBrand : theme.colors.borderDefault,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.contador, { color: theme.colors.textSecondary }]}>
          {atual} de {total}
        </Text>
      </View>

      <Animated.View
        key={passo}
        style={styles.secao}
        entering={
          reduzido ? FadeInRight.duration(duration.instant) : FadeInRight.duration(duration.base)
        }
        exiting={
          reduzido ? FadeOutLeft.duration(duration.instant) : FadeOutLeft.duration(duration.fast)
        }
      >
        <ScrollView
          contentContainerStyle={styles.corpo}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.textos}>
            <Text
              accessibilityRole="header"
              style={[styles.titulo, { color: theme.colors.textPrimary }]}
            >
              {titulo}
            </Text>
            <Text style={[styles.subtitulo, { color: theme.colors.textSecondary }]}>
              {subtitulo}
            </Text>
          </View>
          {conteudo}
        </ScrollView>
        <View style={styles.rodape}>{rodape}</View>
      </Animated.View>
    </SafeAreaView>
  );
}

function cartaoNeutro(theme: ReturnType<typeof useTheme>) {
  return { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault };
}

function CartaoBloqueado({
  app,
  total,
  reduzido,
}: {
  app: InstalledApp | null;
  total: number;
  reduzido: boolean;
}) {
  const theme = useTheme();
  const entrada = useSharedValue(reduzido ? 1 : 0);

  useEffect(() => {
    entrada.value = reduzido ? 1 : withSpring(1, { damping: 14, stiffness: 140, mass: 0.6 });
  }, [entrada, reduzido]);

  const estilo = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ scale: 0.85 + entrada.value * 0.15 }],
  }));

  return (
    <Animated.View style={[styles.cartao, styles.cartaoFinal, cartaoNeutro(theme), estilo]}>
      <IconeApp iconUri={app?.iconUri ?? null} tamanho={56} />
      <View style={styles.textosFinal}>
        <Text style={[styles.nomeFinal, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {app?.label ?? 'Aplicativo'}
        </Text>
        <Text style={[styles.legendaFinal, { color: theme.colors.textSecondary }]}>
          {legendaDaConclusao(total)}
        </Text>
      </View>
      <View style={[styles.seloBloqueado, { backgroundColor: theme.colors.bgBrandSubtle }]}>
        <Ionicons name="shield-outline" size={14} color={theme.colors.textBrand} />
        <Text style={[styles.textoBloqueado, { color: theme.colors.textBrand }]}>Bloqueado</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
    paddingRight: spacing[4],
  },
  voltar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentos: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[1] + 2,
  },
  segmento: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  contador: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  secao: {
    flex: 1,
  },
  corpo: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
    gap: spacing[5],
  },
  textos: {
    gap: spacing[2],
  },
  titulo: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
  },
  subtitulo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  corpoTexto: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  rodape: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  legendaRodape: {
    textAlign: 'center',
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  cartaoHoras: {
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  numeroCaixa: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing[2],
  },
  numero: {
    fontSize: typography.timerHero.fontSize,
    lineHeight: typography.timerHero.lineHeight,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unidade: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
  },
  escala: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textoEscala: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  atalhos: {
    gap: spacing[2],
  },
  rotuloAtalhos: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  linhaAtalhos: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    minHeight: 44,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  textoChip: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '700',
  },
  cabecalhoExemplo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloCartao: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '700',
  },
  selo: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  textoSelo: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  itemLista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  textoItem: {
    flex: 1,
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
  linhaPermissao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 40,
  },
  pronto: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: '700',
  },
  liberar: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
  },
  textoLiberar: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: '700',
  },
  lista: {
    height: APP_ROW_HEIGHT * APPS_VISIVEIS + 2,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  semResultado: {
    padding: spacing[4],
  },
  listaFeedback: {
    gap: spacing[3],
  },
  cartaoFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  textosFinal: {
    flex: 1,
    gap: 2,
  },
  nomeFinal: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
    fontWeight: '700',
  },
  legendaFinal: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  seloBloqueado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  textoBloqueado: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '700',
  },
  oferta: {
    gap: spacing[2],
  },
  hero: {
    gap: spacing[4],
  },
  cabecalhoOferta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tituloOferta: {
    flex: 1,
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: '800',
  },
  corpoOferta: {
    fontSize: typography.callout.fontSize,
    lineHeight: 22,
  },
  divisoria: {
    height: StyleSheet.hairlineWidth,
  },
  linhaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rotuloInterruptor: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '700',
  },
  legendaOferta: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    paddingHorizontal: spacing[1],
  },
});
