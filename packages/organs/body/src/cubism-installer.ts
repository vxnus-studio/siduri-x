import { join } from 'node:path';
import { existsSync, createWriteStream, createReadStream, promises as fsPromises } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

export interface PinnedCubismAsset {
  version: string;
  filename: string;
  url: string;
  sha256: string;
}

/**
 * Pinned official Live2D Cubism Core Web release with SHA-256 integrity digest.
 */
export const DEFAULT_PINNED_CUBISM_CORE: PinnedCubismAsset = {
  version: '5-r.1',
  filename: 'live2dcubismcore.min.js',
  url: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  sha256: '25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f',
};

export async function computeFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex').toLowerCase();
}

export interface CubismInstallOptions {
  targetDir: string;
  asset?: PinnedCubismAsset;
  verifyChecksum?: boolean;
}

/**
 * Downloads the official Live2D Cubism Core binary into the specified target directory.
 * Preserves licensing by downloading directly on the user's host environment.
 */
export async function downloadCubismCore(options: CubismInstallOptions): Promise<string> {
  const asset = options.asset || DEFAULT_PINNED_CUBISM_CORE;
  const targetDir = options.targetDir;
  const destPath = join(targetDir, asset.filename);

  await fsPromises.mkdir(targetDir, { recursive: true });

  if (existsSync(destPath)) {
    if (options.verifyChecksum && asset.sha256) {
      const hash = await computeFileSha256(destPath);
      if (hash.toLowerCase() === asset.sha256.toLowerCase()) {
        return destPath;
      }
      // Corrupt or outdated, remove and re-download
      await fsPromises.unlink(destPath).catch(() => {});
    } else {
      return destPath;
    }
  }

  const tmpPath = `${destPath}.tmp-${Date.now()}`;
  const res = await fetch(asset.url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download Live2D Cubism Core from ${asset.url}: HTTP ${res.status}`);
  }

  const writeStream = createWriteStream(tmpPath);
  await pipeline(res.body as any, writeStream);

  if (options.verifyChecksum && asset.sha256) {
    const downloadedHash = await computeFileSha256(tmpPath);
    if (downloadedHash.toLowerCase() !== asset.sha256.toLowerCase()) {
      await fsPromises.unlink(tmpPath).catch(() => {});
      throw new Error(`SHA-256 checksum mismatch for ${asset.filename}. Expected ${asset.sha256}, got ${downloadedHash}`);
    }
  }

  await fsPromises.rename(tmpPath, destPath);
  return destPath;
}
