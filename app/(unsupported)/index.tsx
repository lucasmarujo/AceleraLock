import { Linking } from 'react-native';

import { Button } from '@/components/Button';
import { TelaDeEstado } from '@/components/TelaDeEstado';

const SITE = 'https://aceleralock.marujo.dev';

/**
 * Veredito 'plataforma-nao-suportada': nem Android nem iOS (web, desktop). O
 * texto antigo culpava o iOS, que hoje tem implementacao propria — a tela so
 * aparece onde o bloqueio de fato nao existe.
 */
export default function PlatformNotSupported() {
  return (
    <TelaDeEstado
      icon="phone-portrait-outline"
      title="Ainda não funciona aqui"
      message="O AceleraLock bloqueia apps no celular. Neste aparelho não há o que ele consiga bloquear."
      action={
        <Button label="Saiba mais" variant="secondary" onPress={() => void Linking.openURL(SITE)} />
      }
      caption="Abre aceleralock.marujo.dev no navegador."
    />
  );
}
