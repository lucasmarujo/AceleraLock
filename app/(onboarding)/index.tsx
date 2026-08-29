import { OnboardingStepScreen } from '@/components/OnboardingStepScreen';

export default function OnboardingStart() {
  return (
    <OnboardingStepScreen
      title="Você escolhe os apps que roubam seu tempo. A gente tranca."
      nextHref="/permiss%C3%B5es"
      ctaLabel="Começar"
    />
  );
}
