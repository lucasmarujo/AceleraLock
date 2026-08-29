import { BackHandler, Platform, Pressable, Text, View } from 'react-native';
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
      {/*
        Unica porta pra fora do onboarding, valida em toda tela do grupo —
        o voltar fisico so navega entre passos (app/(onboarding)/index.tsx),
        nunca fecha o app sozinho. So Android: nao existe API publica de
        auto-encerramento no iOS (nem convencao HIG pra isso), e o grupo
        ainda nem monta la (verdict 'plataforma-nao-suportada' intercepta
        antes). Rotulo e placeholder do uxui como o resto do componente —
        "Sair" em vez de algo como "sem configurar": desistir aqui nao
        apaga nada, a pessoa volta pro mesmo passo no proximo lancamento,
        e um rotulo mais especifico prometeria isso por acidente.
      */}
      {Platform.OS === 'android' && (
        <Pressable accessibilityRole="button" onPress={() => BackHandler.exitApp()}>
          <Text style={{ opacity: 0.6, textDecorationLine: 'underline' }}>Sair</Text>
        </Pressable>
      )}
    </View>
  );
}
