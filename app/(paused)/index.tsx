import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { IconeApp } from '@/components/IconeApp';
import { resumoLiberados } from '@/components/Inicio/inicio';
import { TelaDeEstado } from '@/components/TelaDeEstado';
import AceleralockBlocker, { type InstalledApp } from '@/native/blocker';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ICONES_NA_PILHA = 3;

type Lista = { apps: InstalledApp[]; sites: number };

/**
 * Veredito 'pausado' (src/state/verdict.ts): configurado, permissao ok, mas
 * a propria pessoa desligou a protecao (pedido de STOP_PROTECTION cumprido).
 * Ligar de volta nao tem espera — a friccao do produto e so pra desligar,
 * nunca pra ligar (docs/design-system.md, decisao do supervisor). Config e
 * apps bloqueados continuam intactos: religar nao passa por onboarding.
 */
export default function Paused() {
  const theme = useTheme();
  const { refresh } = useProtectionVerdictContext();
  const [lista, setLista] = useState<Lista | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const pacotes = new Set(AceleralockBlocker.blockedPackages());
        const sites = AceleralockBlocker.blockedDomains().length;
        const apps = await AceleralockBlocker.installedApps();
        if (ativo) {
          setLista({ apps: apps.filter((app) => pacotes.has(app.packageName)), sites });
        }
      } catch (error) {
        console.warn('[Paused] falha ao ler a lista de bloqueados', error);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const handleActivate = () => {
    AceleralockBlocker.start();
    refresh();
  };

  const resumo = lista ? resumoLiberados(lista.apps.length, lista.sites) : null;

  return (
    <TelaDeEstado
      icon={
        <MaterialCommunityIcons
          name="shield-off-outline"
          size={36}
          color={theme.colors.textSecondary}
        />
      }
      title="Proteção desligada"
      message="Você pediu para desligar e cumpriu a espera. Nada está bloqueado agora."
      action={<Button label="Reativar proteção" onPress={handleActivate} />}
      caption="Reativar é imediato. A lista continua a mesma."
    >
      {lista && resumo && (
        <View
          style={[
            styles.cartao,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          {lista.apps.length > 0 && (
            <View style={styles.pilha} accessibilityElementsHidden importantForAccessibility="no">
              {lista.apps.slice(0, ICONES_NA_PILHA).map((app, indice) => (
                <View key={app.packageName} style={indice > 0 && styles.sobreposto}>
                  <IconeApp iconUri={app.iconUri} tamanho={32} contorno={theme.colors.bgSurface} />
                </View>
              ))}
            </View>
          )}
          <View style={styles.textos}>
            <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>{resumo}</Text>
            <Text style={[styles.detalhe, { color: theme.colors.textSecondary }]}>
              Voltam a ser bloqueados ao reativar
            </Text>
          </View>
        </View>
      )}
    </TelaDeEstado>
  );
}

const styles = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4] + 2,
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pilha: {
    flexDirection: 'row',
  },
  sobreposto: {
    marginLeft: -spacing[2],
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '600',
  },
  detalhe: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
});
