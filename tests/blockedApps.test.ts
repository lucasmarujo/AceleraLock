import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readBlockedPackages, writeBlockedPackages } from '../src/storage/blockedApps';

class FakeStorage {
  private map = new Map<string, string>();
  async getItem(k: string) { return this.map.get(k) ?? null; }
  async setItem(k: string, v: string) { this.map.set(k, v); }
  async removeItem(k: string) { this.map.delete(k); }
}

test('read retorna lista vazia quando nada foi gravado', async () => {
  const storage = new FakeStorage();
  const result = await readBlockedPackages(storage);
  assert.deepEqual(result, []);
});

test('write + read round-trip preserva a lista', async () => {
  const storage = new FakeStorage();
  await writeBlockedPackages(['com.instagram.android', 'com.tiktok'], storage);
  const result = await readBlockedPackages(storage);
  assert.deepEqual(result, ['com.instagram.android', 'com.tiktok']);
});

test('read ignora JSON malformado e devolve lista vazia', async () => {
  const storage = new FakeStorage();
  await storage.setItem('aceleralock.blocked_packages', 'isto nao e json');
  const result = await readBlockedPackages(storage);
  assert.deepEqual(result, []);
});

test('read descarta entradas que nao sao string', async () => {
  const storage = new FakeStorage();
  await storage.setItem('aceleralock.blocked_packages', JSON.stringify(['com.x', 42, null, 'com.y']));
  const result = await readBlockedPackages(storage);
  assert.deepEqual(result, ['com.x', 'com.y']);
});
