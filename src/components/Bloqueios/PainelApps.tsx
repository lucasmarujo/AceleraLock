import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppListRow } from '@/components/AppListRow';
import { Button } from '@/components/Button';
import { Overline } from '@/components/Grupo';
import { filtrarApps } from '@/components/Onboarding/passos';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { FamilyActivityPickerView } from '@/native/FamilyActivityPickerView';
import AceleralockBlocker, { type AutomaticClock, type InstalledApp } from '@/native/blocker';
import { mergeBlockedPackages } from '@/state/blockedApps';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BarraSalvar } from './BarraSalvar';
import { EditorDeHorarios } from './EditorDeHorarios';
import { agruparPorApp, legendaComHorarios, type Faixa } from './horarioLivre';
import {
  calcularAlteracoes,
  descreverAlteracoes,
  legendaDaLinha,
  separarPorSalvos,
  tituloDaBarra,
  totalDeAlteracoes,
} from './bloqueios';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; apps: InstalledApp[]; salvos: Set<string> };

const SEM_HORARIOS = new Map<string, Faixa[]>();

/** Falha de leitura vira "nenhum horario": a legenda some, o bloqueio nao muda. */
function lerHorarios(): Map<string, Faixa[]> {
  try {
    return agruparPorApp(AceleralockBlocker.appExceptions());
  } catch (error) {
    console.warn('[PainelApps] falha ao ler horarios livres', error);
    return SEM_HORARIOS;
  }
}

/** Falha de leitura conta como manual: e o lado em que nenhuma faixa vale. */
function lerRelogio(): AutomaticClock {
  try {
    return AceleralockBlocker.automaticClock();
  } catch (error) {
    console.warn('[PainelApps] falha ao ler hora automatica', error);
    return { automaticTime: false, automaticZone: false };
  }
}

type Props = {
  /** Titulo, segmentos e modo restrito: rolam junto com a lista. */
  cabecalho: ReactElement;
  restricted: boolean;
  onSalvo: () => void;
};

/**
 * Lista de apps da aba Bloqueios (antes `AppPickerScreen`, tela empilhada).
 *
 * A gravacao e no "Salvar", nao a cada toque: `setBlockedPackages` reescreve a
 * politica e acorda o servico. E passa por `mergeBlockedPackages`, que preserva
 * o que esta bloqueado mas nao aparece na lista.
 *
 * Com o modo restrito ligado a lista aparece travada em vez de sumir: ver o que
 * esta bloqueado nao enfraquece nada, e o gate de edicao continua aqui (os
 * interruptores e o `salvar` recusam).
 */
export function PainelApps({ cabecalho, restricted, onSalvo }: Props) {
  const theme = useTheme();
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [horarios, setHorarios] = useState<Map<string, Faixa[]>>(SEM_HORARIOS);
  const [relogio, setRelogio] = useState<AutomaticClock>({
    automaticTime: true,
    automaticZone: true,
  });
  const [editando, setEditando] = useState<InstalledApp | null>(null);

  // useFocusEffect e nao useEffect: voltando pra ca depois de instalar ou
  // desinstalar um app, a lista precisa estar certa.
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
          setCarga({ estado: 'pronto', apps, salvos: new Set(bloqueados) });
          // Junto da lista: voltar das Configuracoes com a hora automatica ligada
          // tem de tirar o aviso da folha.
          setHorarios(lerHorarios());
          setRelogio(lerRelogio());
        } catch (error) {
          console.warn('[PainelApps] falha ao listar apps', error);
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
    if (restricted) {
      return;
    }
    setMarcados((anterior) => {
      const proximo = new Set(anterior);
      if (!proximo.delete(packageName)) {
        proximo.add(packageName);
      }
      return proximo;
    });
  };

  const apps = useMemo(() => (carga.estado === 'pronto' ? carga.apps : []), [carga]);
  const salvos = carga.estado === 'pronto' ? carga.salvos : new Set<string>();
  const universo = useMemo(() => apps.map((app) => app.packageName), [apps]);
  const alteracoes = calcularAlteracoes(salvos, marcados, universo);
  const rotulos = useMemo(() => new Map(apps.map((app) => [app.packageName, app.label])), [apps]);

  const salvar = async () => {
    if (restricted) {
      return;
    }
    setSalvando(true);
    try {
      AceleralockBlocker.setBlockedPackages(
        mergeBlockedPackages(AceleralockBlocker.blockedPackages(), universo, [...marcados])
      );
      const gravados = AceleralockBlocker.blockedPackages();
      setMarcados(new Set(gravados));
      setCarga((anterior) =>
        anterior.estado === 'pronto' ? { ...anterior, salvos: new Set(gravados) } : anterior
      );
      // Tirar um app da lista apaga os horarios livres dele no nativo.
      setHorarios(lerHorarios());
      onSalvo();
    } finally {
      setSalvando(false);
    }
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <View style={styles.conteudoIos}>
          {cabecalho}
          <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
            Selecione os apps que deseja bloquear no seletor abaixo.
          </Text>
          <FamilyActivityPickerView style={styles.seletor} />
        </View>
        <View style={styles.rodapeIos}>
          <Button label="Salvar lista" loading={salvando} onPress={salvar} />
        </View>
      </View>
    );
  }

  const { bloqueados, outros } = separarPorSalvos(filtrarApps(apps, busca), salvos);
  const secoes = [
    { titulo: `Bloqueados · ${bloqueados.length}`, data: bloqueados },
    { titulo: 'Outros apps', data: outros },
  ].filter((secao) => secao.data.length > 0);

  const topo = (
    <View style={styles.topo}>
      {cabecalho}
      {carga.estado === 'pronto' && apps.length > 0 && (
        <TextField
          value={busca}
          onChangeText={setBusca}
          placeholder={`Buscar entre ${apps.length} apps`}
          accessibilityLabel="Buscar app pelo nome"
          leadingIcon="search"
          tamanho="sm"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      {carga.estado === 'carregando' && (
        <View style={styles.feedback}>
          {[0, 1, 2, 3, 4].map((linha) => (
            <Skeleton key={linha} width="100%" height={56} />
          ))}
        </View>
      )}
      {carga.estado === 'erro' && (
        <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
          Não deu para ler a lista de apps do aparelho. Saia e entre nesta tela para tentar de novo.
        </Text>
      )}
    </View>
  );

  const total = totalDeAlteracoes(alteracoes);

  return (
    <View style={styles.container}>
      <SectionList
        sections={secoes}
        keyExtractor={(app) => app.packageName}
        ListHeaderComponent={topo}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          carga.estado === 'pronto' ? (
            <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
              {apps.length === 0
                ? 'Nenhum app para escolher neste aparelho.'
                : 'Nenhum app com esse nome.'}
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.cabecalhoSecao}>
            <Overline>{section.titulo}</Overline>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const primeiro = index === 0;
          const ultimo = index === section.data.length - 1;
          // Horario livre so para app ja gravado como bloqueado e ainda marcado: app
          // que "bloqueia ao salvar" ainda nao tem bloqueio para abrir excecao.
          const bloqueadoDeVerdade = salvos.has(item.packageName) && marcados.has(item.packageName);
          const faixas = horarios.get(item.packageName) ?? [];
          return (
            <View
              style={[
                styles.celula,
                {
                  backgroundColor: theme.colors.bgSurface,
                  borderColor: theme.colors.borderDefault,
                },
                primeiro && styles.celulaPrimeira,
                ultimo && styles.celulaUltima,
                !primeiro && {
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.borderDefault,
                },
              ]}
            >
              <AppListRow
                app={item}
                marcado={marcados.has(item.packageName)}
                onToggle={() => alternar(item.packageName)}
                legenda={
                  (bloqueadoDeVerdade && legendaComHorarios(faixas.length)) ||
                  legendaDaLinha(salvos.has(item.packageName), marcados.has(item.packageName))
                }
                legendaDestacada={bloqueadoDeVerdade}
                disabled={restricted}
                acao={
                  bloqueadoDeVerdade ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Horários livres do ${item.label}`}
                      hitSlop={4}
                      onPress={() => setEditando(item)}
                      style={({ pressed }) => [
                        styles.horarios,
                        pressed && { backgroundColor: theme.colors.bgSunken },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={22}
                        color={
                          faixas.length > 0 ? theme.colors.textBrand : theme.colors.textTertiary
                        }
                      />
                    </Pressable>
                  ) : undefined
                }
              />
            </View>
          );
        }}
      />

      {editando && (
        <EditorDeHorarios
          key={editando.packageName}
          app={editando}
          faixasSalvas={horarios.get(editando.packageName) ?? []}
          restricted={restricted}
          automaticTime={relogio.automaticTime}
          automaticZone={relogio.automaticZone}
          onClose={() => setEditando(null)}
          onSalvar={(faixas) => {
            AceleralockBlocker.setAppExceptions(editando.packageName, faixas);
            setHorarios(lerHorarios());
            setEditando(null);
          }}
        />
      )}

      {total > 0 && !restricted && (
        <BarraSalvar
          titulo={tituloDaBarra(alteracoes)}
          detalhe={descreverAlteracoes(alteracoes, (pacote) => rotulos.get(pacote) ?? pacote)}
          salvando={salvando}
          onSalvar={salvar}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lista: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
  },
  topo: {
    gap: spacing[4],
  },
  feedback: {
    gap: spacing[3],
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  cabecalhoSecao: {
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  horarios: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celula: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  celulaPrimeira: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  celulaUltima: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  conteudoIos: {
    flex: 1,
    gap: spacing[4],
    paddingHorizontal: spacing[4],
  },
  seletor: {
    flex: 1,
  },
  rodapeIos: {
    padding: spacing[4],
  },
});
