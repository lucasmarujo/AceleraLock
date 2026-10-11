import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  contarPendentes,
  itensDePermissao,
  type ItemDePermissao,
} from '@/components/Ajustes/ajustes';
import { Avatar } from '@/components/Avatar';
import { Grupo, Overline } from '@/components/Grupo';
import { ListRow } from '@/components/ListRow';
import { SliderHoras } from '@/components/Onboarding/SliderHoras';
import { SegmentedControl } from '@/components/SegmentedControl';
import AceleralockBlocker from '@/native/blocker';
import { readDailyHours, readUserName, saveDailyHours } from '@/state/onboardingStorage';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { PREFERENCIAS, ROTULOS_PREFERENCIA } from '@/theme/preferenciaTema';
import { useThemePreference } from '@/theme/ThemePreferenceContext';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SITE = 'https://aceleralock.marujo.dev';

async function abrirPermissao(item: ItemDePermissao) {
  if (Platform.OS === 'ios' || item.intent === null) {
    await Linking.openSettings();
    return;
  }
  await Linking.sendIntent(item.intent).catch(() => Linking.openSettings());
}

/**
 * Antes "Perfil": misturava tempo de tela (que agora mora na Inicio) com
 * configuracao. Ficou so configuracao, agrupada pelo que a pessoa procura.
 *
 * O modo restrito aparece aqui como atalho para a aba Bloqueios, onde ele mora
 * junto da lista que trava — dois interruptores pro mesmo estado seriam duas
 * confirmacoes pra manter iguais.
 */
export default function Ajustes() {
  const theme = useTheme();
  const router = useRouter();
  const { permissions, restricted } = useProtectionVerdictContext();
  const { preferencia, definirPreferencia } = useThemePreference();
  const { waitMinutes } = AceleralockBlocker.protectionState();

  const [nome, setNome] = useState<string | null>(null);
  const [horas, setHoras] = useState<number | null>(null);
  const [editandoHoras, setEditandoHoras] = useState(false);

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

  const permissoes = itensDePermissao(permissions, Platform.OS === 'ios' ? 'ios' : 'android');
  const pendentes = contarPendentes(permissoes);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text
          accessibilityRole="header"
          style={[styles.titulo, { color: theme.colors.textPrimary }]}
        >
          Ajustes
        </Text>

        <View
          style={[
            styles.perfil,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${nome ?? 'Sem nome'}. Estimativa de tempo de tela`}
            accessibilityHint={editandoHoras ? 'Fecha o ajuste' : 'Abre o ajuste da estimativa'}
            accessibilityState={{ expanded: editandoHoras }}
            onPress={() => setEditandoHoras((atual) => !atual)}
            style={({ pressed }) => [
              styles.linhaPerfil,
              pressed && { backgroundColor: theme.colors.bgSunken },
            ]}
          >
            <Avatar nome={nome} size={40} />
            <View style={styles.textos}>
              <Text style={[styles.nome, { color: theme.colors.textPrimary }]}>
                {nome ?? 'Sem nome'}
              </Text>
              <Text style={[styles.estimativa, { color: theme.colors.textSecondary }]}>
                {horas === null
                  ? 'Estimativa não definida'
                  : `Estimativa: ${horas} h de tela por dia`}
              </Text>
            </View>
            <Ionicons
              name={editandoHoras ? 'chevron-up' : 'chevron-forward'}
              size={20}
              color={theme.colors.textTertiary}
            />
          </Pressable>
          {editandoHoras && (
            <View style={[styles.editor, { borderTopColor: theme.colors.borderDefault }]}>
              <SliderHoras horas={horas ?? 1} onChange={alterarHoras} />
            </View>
          )}
        </View>

        <Grupo titulo="Proteção">
          <ListRow
            icon={
              <Ionicons
                name={restricted ? 'lock-closed-outline' : 'lock-open-outline'}
                size={22}
                color={restricted ? theme.colors.iconWarning : theme.colors.textPrimary}
              />
            }
            label="Modo restrito"
            value={restricted ? 'Ligado' : 'Desligado'}
            chevron
            onPress={() => router.navigate('/bloqueios')}
          />
          <ListRow
            icon={<Ionicons name="hourglass-outline" size={22} color={theme.colors.textPrimary} />}
            label="Tempo de espera"
            value={`${waitMinutes} min`}
          />
        </Grupo>

        <View style={styles.secao}>
          <View style={styles.cabecalhoSecao}>
            <Overline>Aparência</Overline>
          </View>
          <SegmentedControl
            accessibilityLabel="Aparência"
            segmentos={PREFERENCIAS.map((opcao) => ({
              valor: opcao,
              rotulo: ROTULOS_PREFERENCIA[opcao],
            }))}
            valor={preferencia}
            onChange={definirPreferencia}
          />
        </View>

        <Grupo
          titulo="Permissões"
          detalhe={
            pendentes === 0 ? undefined : pendentes === 1 ? '1 pendente' : `${pendentes} pendentes`
          }
          corDoDetalhe={theme.colors.textWarning}
        >
          {permissoes.map((item) => (
            <ListRow
              key={item.chave}
              icon={
                <Ionicons
                  name={item.concedida ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={22}
                  color={item.concedida ? theme.colors.textBrand : theme.colors.iconWarning}
                />
              }
              label={item.titulo}
              description={item.descricao}
              value={item.concedida ? item.rotuloConcedida : undefined}
              emphasis="brand"
              accessory={
                item.concedida ? undefined : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.rotuloAcao}: ${item.titulo}`}
                    hitSlop={4}
                    onPress={() => void abrirPermissao(item)}
                    style={({ pressed }) => [
                      styles.acao,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: pressed ? theme.colors.bgSunken : theme.colors.bgSurface,
                      },
                    ]}
                  >
                    <Text style={[styles.textoAcao, { color: theme.colors.textPrimary }]}>
                      {item.rotuloAcao}
                    </Text>
                  </Pressable>
                )
              }
            />
          ))}
        </Grupo>

        <Grupo titulo="Sobre">
          <ListRow
            label="Política de privacidade"
            accessory={<Ionicons name="open-outline" size={20} color={theme.colors.textTertiary} />}
            onPress={() => void Linking.openURL(`${SITE}/#privacidade`)}
          />
          <ListRow
            label="Termos de uso"
            accessory={<Ionicons name="open-outline" size={20} color={theme.colors.textTertiary} />}
            onPress={() => void Linking.openURL(`${SITE}/#termos`)}
          />
          <ListRow label="Versão" value={Constants.expoConfig?.version ?? '—'} />
        </Grupo>

        <Text style={[styles.rodape, { color: theme.colors.textTertiary }]}>
          Tudo fica no seu celular. Sem conta, sem servidor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  titulo: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
  },
  perfil: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  linhaPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[4],
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  estimativa: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  editor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  secao: {
    gap: spacing[2],
  },
  cabecalhoSecao: {
    paddingHorizontal: spacing[1],
  },
  acao: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  textoAcao: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: '700',
  },
  rodape: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    paddingHorizontal: spacing[1],
  },
});
