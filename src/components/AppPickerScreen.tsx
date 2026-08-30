import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { mergeBlockedPackages } from '@/state/blockedApps';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  ctaLabel: string;
  onConfirm: () => void | Promise<void>;
};

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; apps: InstalledApp[] };

/**
 * docs/design-system.md §3.8 (`AppListItem`) e §3.9 (`Toggle`): rotulo a
 * esquerda, Switch nativo a direita, estado dito por accessibilityState e nao
 * so pela posicao do botao.
 *
 * ponytail: sem icone do app nesta versao — resolver o Drawable de cada
 * pacote e converter pra imagem do RN custa uma ponte propria e atrasa a
 * lista inteira. Se o produto pedir o icone, ele entra no InstalledApp como
 * data URI resolvido em lote no nativo, nao um por linha a partir do JS.
 *
 * A gravacao e no CTA, nao a cada toque: `setBlockedPackages` reescreve a
 * politica e acorda o servico, e fazer isso a cada tique de Switch seria um
 * refresh de politica por toque.
 */
export function AppPickerScreen({ title, ctaLabel, onConfirm }: Props) {
  const theme = useTheme();
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  // useFocusEffect e nao useEffect: voltando pra ca depois de instalar ou
  // desinstalar um app, a lista precisa estar certa — a tela continua
  // montada por baixo enquanto outra esta empilhada.
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
          console.warn('[AppPickerScreen] falha ao listar apps', error);
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
    setMarcados((anterior) => {
      const proximo = new Set(anterior);
      if (!proximo.delete(packageName)) {
        proximo.add(packageName);
      }
      return proximo;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const visiveis = carga.estado === 'pronto' ? carga.apps.map((app) => app.packageName) : [];
      AceleralockBlocker.setBlockedPackages(
        mergeBlockedPackages(AceleralockBlocker.blockedPackages(), visiveis, [...marcados])
      );
      await onConfirm();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>

      {carga.estado === 'carregando' && (
        <View style={styles.feedback}>
          {[0, 1, 2, 3, 4].map((linha) => (
            <Skeleton key={linha} width="100%" height={52} />
          ))}
        </View>
      )}

      {carga.estado === 'erro' && (
        <View style={styles.feedback}>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            Não deu para ler a lista de apps do aparelho. Saia e entre nesta tela para tentar de novo.
          </Text>
        </View>
      )}

      {carga.estado === 'pronto' && (
        <FlatList
          style={styles.lista}
          contentContainerStyle={styles.listaConteudo}
          data={carga.apps}
          keyExtractor={(app) => app.packageName}
          ListEmptyComponent={
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              Nenhum app para escolher neste aparelho.
            </Text>
          }
          renderItem={({ item }) => {
            const marcado = marcados.has(item.packageName);
            return (
              <View style={[styles.linha, { backgroundColor: theme.colors.bgSurface }]}>
                <Text
                  style={[styles.rotulo, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: marcado }}
                  value={marcado}
                  onValueChange={() => alternar(item.packageName)}
                />
              </View>
            );
          }}
        />
      )}

      <Button
        label={ctaLabel}
        loading={salvando}
        disabled={carga.estado !== 'pronto'}
        onPress={salvar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing[6],
    gap: spacing[4],
  },
  title: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  feedback: {
    flex: 1,
    gap: spacing[3],
  },
  lista: {
    flex: 1,
  },
  listaConteudo: {
    // §2 do design-system: gap padrao entre itens de lista.
    gap: spacing[3],
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    minHeight: 52,
  },
  rotulo: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
