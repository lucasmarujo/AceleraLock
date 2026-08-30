import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Switch, Text, View } from 'react-native';
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

const ICON_SIZE = 40;

/**
 * docs/design-system.md §3.8 (`AppListItem`) e §3.9 (`Toggle`): icone do app +
 * nome a esquerda, Switch nativo a direita, estado dito por accessibilityState
 * e nao so pela posicao do botao.
 *
 * O icone chega como `file://` de um PNG que o nativo mantem em cache
 * (InstalledAppsResolver) — o JS nunca desenha Drawable nem carrega base64.
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

  // Conta o que esta em tela, nao marcados.size: a selecao carrega tambem os
  // pacotes bloqueados que a lista nao mostra (ver mergeBlockedPackages), e um
  // numero maior que o visivel pareceria erro de contagem.
  const escolhidos =
    carga.estado === 'pronto'
      ? carga.apps.filter((app) => marcados.has(app.packageName)).length
      : 0;
  const resumo =
    escolhidos === 0
      ? 'Nenhum app escolhido ainda.'
      : escolhidos + (escolhidos === 1 ? ' app bloqueado.' : ' apps bloqueados.');

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
      <View style={styles.cabecalho}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {carga.estado === 'pronto' && (
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{resumo}</Text>
        )}
      </View>

      {carga.estado === 'carregando' && (
        <View style={styles.feedback}>
          {[0, 1, 2, 3, 4].map((linha) => (
            <Skeleton key={linha} width="100%" height={56} />
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
              <View
                style={[
                  styles.linha,
                  {
                    backgroundColor: marcado ? theme.colors.bgBrandSubtle : theme.colors.bgSurface,
                    borderColor: marcado ? theme.colors.borderBrand : theme.colors.borderDefault,
                  },
                ]}
              >
                {item.iconUri ? (
                  <Image
                    source={{ uri: item.iconUri }}
                    style={styles.icone}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  // Mesmo espaco reservado: lista que muda de alinhamento no
                  // meio e pior do que lista sem icone nenhum.
                  <View style={[styles.icone, { backgroundColor: theme.colors.bgSunken }]} />
                )}
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
  cabecalho: {
    gap: spacing[1],
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
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 56,
  },
  icone: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.sm,
  },
  rotulo: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
