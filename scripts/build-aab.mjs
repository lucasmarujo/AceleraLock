import { spawnSync } from 'node:child_process';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const ANDROID = path.join(RAIZ, 'android');
const GRADLEW = path.join(ANDROID, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

// O gradle.properties do Expo limita o Metaspace a 512 MiB. O release compila
// todos os ABIs e estoura esse teto no compileReleaseKotlin; o debug cabe.
const MEMORIA_GRADLE = '-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g';

const passos = [
  ['npx expo prebuild --platform android --clean', RAIZ],
  [`"${GRADLEW}" --stop`, ANDROID],
  [`"${GRADLEW}" bundleRelease "${MEMORIA_GRADLE}"`, ANDROID],
];

for (const [comando, cwd] of passos) {
  const { status } = spawnSync(comando, { cwd, shell: true, stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}

console.log(
  `\nAAB: ${path.join(RAIZ, 'android/app/build/outputs/bundle/release/app-release.aab')}`
);
