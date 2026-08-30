import { BackHandler, Platform, Pressable, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  /**
   * Ausente no ultimo passo: quem tira a pessoa do grupo (onboarding) e o
   * veredito reavaliado, nao um push. Empurrar '/' de dentro do grupo so
   * volta pro primeiro passo — era o loop entre as duas telas.
   */
  nextHref?: Href;
  ctaLabel?: string;
  onPressContinue?: () => void | Promise<void>;
};

/**
 * Estrutura das telas de app/(onboarding)/**, do `mobile`; visual e conteúdo
 * (docs/design-system.md) são do `uxui`, preenchidos aqui. O rótulo e a
 * hierarquia do link "Sair" abaixo são intencionais — ver o comentário dele.
 */
export function OnboardingStepScreen({ title, nextHref, ctaLabel = 'Continuar', onPressContinue }: Props) {
  const router = useRouter();
  const theme = useTheme();

  const handlePress = async () => {
    if (onPressContinue) {
      await onPressContinue();
    }
    if (nextHref) {
      router.push(nextHref);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[4],
        padding: spacing[6],
        backgroundColor: theme.colors.bgCanvas,
      }}
    >
      <Text
        style={{
          fontSize: typography.title3.fontSize,
          lineHeight: typography.title3.lineHeight,
          fontWeight: typography.title3.fontWeight,
          textAlign: 'center',
          color: theme.colors.textPrimary,
        }}
      >
        {title}
      </Text>
      <Button label={ctaLabel} onPress={handlePress} />
      {/*
        Unica porta pra fora do onboarding, valida em toda tela do grupo —
        o voltar fisico so navega entre passos (app/(onboarding)/index.tsx),
        nunca fecha o app sozinho. So Android: nao existe API publica de
        auto-encerramento no iOS (nem convencao HIG pra isso), e o grupo
        ainda nem monta la (verdict 'plataforma-nao-suportada' intercepta
        antes). "Sair" em vez de algo como "sem configurar": desistir aqui
        nao apaga nada, a pessoa volta pro mesmo passo no proximo
        lancamento, e um rotulo mais especifico prometeria isso por
        acidente — nao trocar o texto sem preservar essa restricao.

        Sem Button: e deliberadamente subordinado ao CTA, nao um ghost de
        segundo destaque — ghost usa text.brand (turquesa), que chamaria
        tanta atencao quanto o primario. text.tertiary + underline mantem a
        saida presente e acessivel, nunca competindo por atencao com
        "Continuar"/"Comecar".
      */}
      {Platform.OS === 'android' && (
        <Pressable accessibilityRole="button" onPress={() => BackHandler.exitApp()}>
          <Text
            style={{
              color: theme.colors.textTertiary,
              textDecorationLine: 'underline',
              fontSize: typography.footnote.fontSize,
              lineHeight: typography.footnote.lineHeight,
            }}
          >
            Sair
          </Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
