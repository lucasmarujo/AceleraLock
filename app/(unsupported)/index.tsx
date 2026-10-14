import { Linking } from 'react-native';

import { Button } from '@/components/Button';
import { TelaDeEstado } from '@/components/TelaDeEstado';

const SITE = 'https://aceleralock.marujo.dev';

/**
 * Veredito 'plataforma-nao-suportada'. O texto segue o Paper (e o da versao
 * anterior desta tela), que fala do iPhone.
 */
export default function PlatformNotSupported() {
  return (
    <TelaDeEstado
      icon="phone-portrait-outline"
      title="Ainda não funciona no iPhone"
      message="Por enquanto o AceleraLock só bloqueia apps no Android. No iPhone, o bloqueio depende de uma liberação especial da Apple."
      action={
        <Button label="Saiba mais" variant="secondary" onPress={() => void Linking.openURL(SITE)} />
      }
      caption="Abre aceleralock.marujo.dev no navegador."
    />
  );
}
