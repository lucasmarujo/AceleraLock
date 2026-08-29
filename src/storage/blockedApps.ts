import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_BLOCKED_PACKAGES = 'aceleralock.blocked_packages';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const defaultStorage: Storage = AsyncStorage;

export async function readBlockedPackages(storage: Storage = defaultStorage): Promise<string[]> {
  const raw = await storage.getItem(KEY_BLOCKED_PACKAGES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeBlockedPackages(packages: string[], storage: Storage = defaultStorage): Promise<void> {
  await storage.setItem(KEY_BLOCKED_PACKAGES, JSON.stringify(packages));
}
