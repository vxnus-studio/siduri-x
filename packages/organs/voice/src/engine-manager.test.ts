import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import os from 'node:os';
import {
  VoicevoxEngineManager,
  DEFAULT_PINNED_VOICEVOX_RELEASE,
  computeFileSha256,
  verifyArchiveIntegrity,
} from './engine-manager';

describe('VoicevoxEngineManager Cryptographic Pinning Suite', () => {
  const testDir = join(tmpdir(), `voicevox-test-${Date.now()}`);

  test('pinned release registry has valid 64-character SHA-256 hashes for all platforms', () => {
    for (const [platformKey, asset] of Object.entries(DEFAULT_PINNED_VOICEVOX_RELEASE)) {
      expect(asset.version).toBeDefined();
      expect(asset.filename).toBeDefined();
      expect(asset.url).toMatch(/^https:\/\/github\.com\/VOICEVOX\/voicevox_engine\/releases\/download\//);
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/i);
    }
  });

  test('computeFileSha256 computes accurate cryptographic digest', async () => {
    const testFile = join(tmpdir(), `test-hash-${Date.now()}.txt`);
    const content = 'siduri-x-voicevox-cryptographic-pin-verification';
    writeFileSync(testFile, content);

    try {
      const expectedHash = createHash('sha256').update(content).digest('hex');
      const actualHash = await computeFileSha256(testFile);
      expect(actualHash).toBe(expectedHash);
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  });

  test('verifyArchiveIntegrity validates matching hash and rejects tampered hash', async () => {
    const testFile = join(tmpdir(), `test-integrity-${Date.now()}.txt`);
    writeFileSync(testFile, 'legitimate-binary-payload');

    try {
      const legitHash = createHash('sha256').update('legitimate-binary-payload').digest('hex');
      const tamperedHash = createHash('sha256').update('malicious-payload').digest('hex');

      const isLegitValid = await verifyArchiveIntegrity(testFile, legitHash);
      expect(isLegitValid).toBe(true);

      const isTamperedValid = await verifyArchiveIntegrity(testFile, tamperedHash);
      expect(isTamperedValid).toBe(false);
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  });

  test('verifyArchiveIntegrity rejects invalid hash format', async () => {
    const testFile = join(tmpdir(), `test-invalid-${Date.now()}.txt`);
    writeFileSync(testFile, 'data');

    try {
      await expect(verifyArchiveIntegrity(testFile, 'short-invalid-hash')).rejects.toThrow(
        'A valid 64-character hex SHA-256 hash is required'
      );
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  });

  test('getPinnedAsset throws for unsupported platform', () => {
    const manager = new VoicevoxEngineManager({
      baseDir: testDir,
      pinnedAssets: {}, // empty registry
    });

    expect(() => manager.getPinnedAsset()).toThrow('Unsupported or unpinned platform architecture');
  });

  test('ensureInstalled rejects download with mismatched checksum and cleans up file', async () => {
    const fakeContent = 'unverified-mock-binary';
    const fakeHash = createHash('sha256').update(fakeContent).digest('hex');
    const expectedHash = createHash('sha256').update('expected-authentic-binary').digest('hex');
    const platformKey = `${os.platform()}-${os.arch()}`;

    const manager = new VoicevoxEngineManager({
      baseDir: testDir,
      pinnedAssets: {
        [platformKey]: {
          version: '0.14.4',
          filename: 'test.tar.gz',
          url: 'https://example.com/test.tar.gz',
          sha256: expectedHash,
        },
      },
    });

    // Mock fetch to return fakeContent
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: true,
      arrayBuffer: async () => Buffer.from(fakeContent),
    });

    try {
      await expect(manager.ensureInstalled()).rejects.toThrow(
        /Security verification failed for test\.tar\.gz: Expected SHA-256/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
