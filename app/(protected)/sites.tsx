import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { TextField } from '@/components/TextField';
import AceleralockBlocker from '@/native/blocker';
import { normalizarDominio } from '@/state/blockedSites';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Carga = { estado: 'erro' } | { estado: 'pronto'; dominios: string[] };

function lerDominios(): Carga {
  try {
    return { estado: 'pronto', dominios: AceleralockBlocker.blockedDomains() };
  } catch (error) {
    console.warn('[ProtectedSites] falha ao ler sites bloqueados', error);
    return { estado: 'erro' };
  }
}

/**
 * Par de `apps.tsx` para sites: mesmo gate do modo restrito, mesma gravacao so
 * no CTA. Adicionar e remover sao livres, como na lista de apps.
 *
 * No Android o bloqueio depende do servico de acessibilidade, que e opcional. O
 * cartao explica o que ele le antes de mandar a pessoa pras Configuracoes — a
 * divulgacao vem antes do pedido, nunca depois. A volta das Configuracoes
 * reavalia sozinha: o veredito ja relê as permissoes quando o app volta ao ar.
 */
export default function ProtectedSites() {
  const router = useRouter();
  const theme = useTheme();
  const { restricted, permissions } = useProtectionVerdictContext();
  const [carga, setCarga] = useState<Carga>(lerDominios);
  const [entrada, setEntrada] = useState('');
  const [invalido, setInvalido] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (restricted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
        <View
          style={[
            styles.cartao,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
            Modo restrito ativo
          </Text>
          <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
            Para mudar a lista de sites, desligue o modo restrito no Perfil. A desativação pede 30
            minutos de espera.
          </Text>
        </View>
        <ScrollView />
        <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const adicionar = () => {
    const dominio = normalizarDominio(entrada);
    if (!dominio) {
      setInvalido(true);
      return;
    }
    setInvalido(false);
    setEntrada('');
    setCarga((anterior) =>
      anterior.estado === 'pronto' && !anterior.dominios.includes(dominio)
        ? { estado: 'pronto', dominios: [...anterior.dominios, dominio] }
        : anterior
    );
  };

  const remover = (dominio: string) => {
    setCarga((anterior) =>
      anterior.estado === 'pronto'
        ? { estado: 'pronto', dominios: anterior.dominios.filter((d) => d !== dominio) }
        : anterior
    );
  };

  const salvar = () => {
    if (carga.estado !== 'pronto') {
      return;
    }
    setSalvando(true);
    try {
      AceleralockBlocker.setBlockedDomains(carga.dominios);
      router.back();
    } finally {
      setSalvando(false);
    }
  };

  const precisaAcessibilidade = Platform.OS === 'android' && permissions?.accessibility === false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.cabecalho}>
          <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>Sites bloqueados</Text>
          <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
            O site e todos os endereços dentro dele ficam bloqueados no navegador.
          </Text>
        </View>

        {precisaAcessibilidade && (
          <View
            style={[
              styles.cartao,
              { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
            ]}
          >
            <Text style={[styles.subtitulo, { color: theme.colors.textPrimary }]}>
              Ative a acessibilidade para bloquear sites
            </Text>
            <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
              O AceleraLock usa o serviço de acessibilidade do Android só para ler o endereço na
              barra do Chrome, Samsung Internet, Firefox, Edge e Brave e comparar com a sua lista.
              Não lê o conteúdo das páginas, não guarda o que você visita e nada sai do aparelho.
            </Text>
            <Button
              label="Ativar nas Configurações"
              variant="secondary"
              onPress={() =>
                Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS').catch(() =>
                  Linking.openSettings()
                )
              }
            />
          </View>
        )}

        {carga.estado === 'erro' && (
          <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
            Não deu para ler a lista de sites. Saia e entre nesta tela para tentar de novo.
          </Text>
        )}

        {carga.estado === 'pronto' && (
          <>
            <View style={styles.campo}>
              <TextField
                value={entrada}
                onChangeText={(texto) => {
                  setEntrada(texto);
                  setInvalido(false);
                }}
                placeholder="instagram.com"
                accessibilityLabel="Endereço do site para bloquear"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={adicionar}
              />
              {invalido && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.corpo, { color: theme.colors.textDanger }]}
                >
                  Digite o endereço de um site, como instagram.com.
                </Text>
              )}
              <Button label="Adicionar" variant="secondary" size="md" onPress={adicionar} />
            </View>

            {carga.dominios.length === 0 ? (
              <EmptyState
                title="Nenhum site bloqueado ainda"
                message="Digite o endereço do primeiro site que rouba seu tempo."
              />
            ) : (
              carga.dominios.map((dominio) => (
                <ListRow
                  key={dominio}
                  label={dominio}
                  accessory={
                    <Button
                      label="Remover"
                      variant="ghost"
                      size="md"
                      onPress={() => remover(dominio)}
                    />
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <Button
        label="Salvar lista"
        loading={salvando}
        disabled={carga.estado !== 'pronto'}
        onPress={salvar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[6], gap: spacing[4] },
  conteudo: { gap: spacing[4] },
  cabecalho: { gap: spacing[1] },
  campo: { gap: spacing[2] },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  titulo: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  subtitulo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
