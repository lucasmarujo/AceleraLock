import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

type Props = {
  title: string;
  nextHref: Href;
  ctaLabel?: string;
  onPressContinue?: () => void | Promise<void>;
};

/**
 * Placeholder estrutural para as telas de app/(onboarding)/**. Visual e
 * conteudo real (textos exatos do onboarding, componentes de
 * docs/design-system.md) sao do uxui — trocar o miolo aqui, nao a
 * assinatura da rota. Isto so garante que a rota existe, navega, e nao
 * pisa em arquivo que o uxui vai editar.
 */
export function OnboardingStepScreen({ title, nextHref, ctaLabel = 'Continuar', onPressContinue }: Props) {
  const router = useRouter();

  const handlePress = async () => {
    if (onPressContinue) {
      await onPressContinue();
    }
    router.push(nextHref);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#03c3bf' }}
      >
        <Text style={{ color: '#04141c', fontWeight: '600' }}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}
