import { Text, View } from 'react-native';

export default function PlatformNotSupported() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', textAlign: 'center' }}>
        O iOS ainda não bloqueia nada neste app.
      </Text>
      <Text style={{ textAlign: 'center' }}>
        Hoje o bloqueio só funciona no Android.
      </Text>
    </View>
  );
}
