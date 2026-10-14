import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel: string;
};

/** Fundo escurecido do sheet. `brand.tema` a 48%: escurece sem virar preto chapado. */
const SCRIM = 'rgba(4, 20, 28, 0.48)';

/**
 * docs/design-system.md §3.13. Confirmacao com consequencia explicada, no lugar
 * do Alert nativo — que nao comporta linha do tempo nem dois botoes do mesmo
 * peso. Dismissivel por toque fora e pelo voltar: fechar e sempre a saida sem
 * custo, nunca uma acao escondida.
 */
export function Sheet({ visible, onClose, children, accessibilityLabel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.raiz}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.folha,
            {
              backgroundColor: theme.colors.bgSurface,
              paddingBottom: insets.bottom + spacing[5],
            },
          ]}
        >
          <View style={[styles.alca, { backgroundColor: theme.colors.borderStrong }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  folha: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[5],
    ...elevation[2],
    shadowOffset: { width: 0, height: -elevation[2].shadowOffset.height },
  },
  alca: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});
