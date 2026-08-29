import { Text, View } from 'react-native';

export default function ProtectedHome() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Você está protegido.</Text>
    </View>
  );
}
