import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmarDesligarRestrito } from '@/components/Bloqueios/ConfirmarDesligarRestrito';
import { ModoRestritoCard } from '@/components/Bloqueios/ModoRestritoCard';
import { PainelApps } from '@/components/Bloqueios/PainelApps';
import { PainelSites } from '@/components/Bloqueios/PainelSites';
import { SegmentedControl } from '@/components/SegmentedControl';
import AceleralockBlocker from '@/native/blocker';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Aba = 'apps' | 'sites';

/** `null` quando a leitura falhou: contador escondido, nunca um "0" que afirma lista vazia. */
type Contagem = { apps: number; sites: number } | null;

function lerContagem(): Contagem {
  try {
    return {
      apps: AceleralockBlocker.blockedPackages().length,
      sites: AceleralockBlocker.blockedDomains().length,
    };
  } catch (error) {
    console.warn('[Bloqueios] falha ao contar bloqueados', error);
    return null;
  }
}

/**
 * Antes eram duas telas empilhadas (`/apps` e `/sites`) abertas por botoes da
 * Inicio, e o modo restrito morava no Perfil, longe da lista que ele trava.
 * Agora e uma aba so, com o interruptor em cima da lista.
 *
 * Os dois paineis ficam montados: trocar de segmento nao descarta alteracao
 * ainda nao salva. A `key` com `restricted` remonta os dois quando o modo muda —
 * ligar com alteracao pendente nao deixa a lista travada mostrando um rascunho
 * que nunca vai ser salvo.
 */
export default function Bloqueios() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ aba?: string }>();
  const { restricted, permissions, refresh } = useProtectionVerdictContext();
  const [aba, setAba] = useState<Aba>(params.aba === 'sites' ? 'sites' : 'apps');
  const [contagem, setContagem] = useState<Contagem>(lerContagem);
  const [confirmando, setConfirmando] = useState(false);
  const { waitMinutes } = AceleralockBlocker.protectionState();

  useFocusEffect(
    useCallback(() => {
      setContagem(lerContagem());
      if (params.aba === 'apps' || params.aba === 'sites') {
        setAba(params.aba);
      }
    }, [params.aba])
  );

  const alternarModoRestrito = () => {
    if (!restricted) {
      AceleralockBlocker.setRestricted(true);
      void refresh();
      return;
    }
    setConfirmando(true);
  };

  const comecarEspera = () => {
    setConfirmando(false);
    if (AceleralockBlocker.requestDisableRestricted()) {
      router.push('/esperando');
    }
  };

  // O cartao do modo restrito mora no segmento Apps (Paper). Em Sites ele so
  // aparece ligado, pra explicar por que a lista nao aceita mudanca.
  const cabecalho = (comModoRestrito: boolean) => (
    <View style={styles.cabecalho}>
      <Text accessibilityRole="header" style={[styles.titulo, { color: theme.colors.textPrimary }]}>
        Bloqueios
      </Text>
      <SegmentedControl
        accessibilityLabel="Tipo de bloqueio"
        segmentos={[
          { valor: 'apps', rotulo: 'Apps', contador: contagem?.apps },
          { valor: 'sites', rotulo: 'Sites', contador: contagem?.sites },
        ]}
        valor={aba}
        onChange={setAba}
      />
      {comModoRestrito && (
        <ModoRestritoCard
          restricted={restricted}
          waitMinutes={waitMinutes}
          onAlternar={alternarModoRestrito}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}
      edges={['top']}
    >
      <View style={[styles.painel, aba !== 'apps' && styles.oculto]}>
        <PainelApps
          key={`apps-${restricted}`}
          cabecalho={cabecalho(true)}
          restricted={restricted}
          onSalvo={() => setContagem(lerContagem())}
        />
      </View>
      <View style={[styles.painel, aba !== 'sites' && styles.oculto]}>
        <PainelSites
          key={`sites-${restricted}`}
          cabecalho={cabecalho(restricted)}
          restricted={restricted}
          permissions={permissions}
          onSalvo={() => setContagem(lerContagem())}
        />
      </View>

      <ConfirmarDesligarRestrito
        visible={confirmando}
        waitMinutes={waitMinutes}
        onClose={() => setConfirmando(false)}
        onConfirmar={comecarEspera}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  painel: {
    flex: 1,
  },
  oculto: {
    display: 'none',
  },
  cabecalho: {
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  titulo: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: typography.heading.letterSpacing,
  },
});
