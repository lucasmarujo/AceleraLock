import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Platform, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppListRow } from '@/components/AppListRow';
import { Button } from '@/components/Button';
import { Overline } from '@/components/Grupo';
import { filtrarApps } from '@/components/Onboarding/passos';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { FamilyActivityPickerView } from '@/native/FamilyActivityPickerView';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { mergeBlockedPackages } from '@/state/blockedApps';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BarraSalvar } from './BarraSalvar';
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
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.colors.borderDefault,
                },
              ]}
            >
              <AppListRow
                app={item}
                marcado={marcados.has(item.packageName)}
                onToggle={() => alternar(item.packageName)}
                legenda={legendaDaLinha(
                  salvos.has(item.packageName),
                  marcados.has(item.packageName)
                )}
                disabled={restricted}
              />
            </View>
          );
        }}
      />

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
    paddingBottom: spacing[2],
  },
  feedback: {
    gap: spacing[3],
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  cabecalhoSecao: {
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[1],
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
