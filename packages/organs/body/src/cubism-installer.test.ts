import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { downloadCubismCore, computeFileSha256, DEFAULT_PINNED_CUBISM_CORE } from './cubism-installer';

describe('Live2D Cubism Core Runtime Installer & Verification', () => {
  const testDir = join(tmpdir(), `siduri-cubism-test-${Date.now()}`);

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('DEFAULT_PINNED_CUBISM_CORE specifies official release metadata and sha256', () => {
    expect(DEFAULT_PINNED_CUBISM_CORE.filename).toBe('live2dcubismcore.min.js');
    expect(DEFAULT_PINNED_CUBISM_CORE.url).toContain('cubism.live2d.com');
    expect(DEFAULT_PINNED_CUBISM_CORE.sha256).toBe('25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f');
  });

  test('downloadCubismCore downloads and verifies official binary', async () => {
    const destPath = await downloadCubismCore({
      targetDir: testDir,
      verifyChecksum: true,
    });

    expect(existsSync(destPath)).toBe(true);
    const hash = await computeFileSha256(destPath);
    expect(hash).toBe(DEFAULT_PINNED_CUBISM_CORE.sha256);

    const content = readFileSync(destPath, 'utf-8');
    expect(content).toContain('Live2D Cubism Core');
  }, 30000);

  test('downloadCubismCore re-uses already verified file without re-downloading', async () => {
    const destPath = await downloadCubismCore({
      targetDir: testDir,
      verifyChecksum: true,
    });

    expect(existsSync(destPath)).toBe(true);
  });
});
