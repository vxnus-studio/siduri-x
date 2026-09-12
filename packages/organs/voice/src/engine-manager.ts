import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { existsSync, mkdirSync, createWriteStream, rmSync, createReadStream, promises as fsPromises } from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import yauzl from 'yauzl';
import tar from 'tar';

export interface PinnedVoicevoxAsset {
  version: string;
  filename: string;
  url: string;
  sha256: string;
  strip?: number;
}

export const DEFAULT_PINNED_VOICEVOX_RELEASE: Record<string, PinnedVoicevoxAsset> = {
  'linux-x64': {
    version: '0.14.4',
    filename: 'voicevox_engine-linux-cpu-0.14.4.tar.gz',
    url: 'https://github.com/VOICEVOX/voicevox_engine/releases/download/0.14.4/voicevox_engine-linux-cpu-0.14.4.tar.gz',
    sha256: '9f86d081884c7d5c5fce8a6e879a8385db1f13b1f5d2222374b5a6c38cecb296',
    strip: 1,
  },
  'linux-arm64': {
    version: '0.14.4',
    filename: 'voicevox_engine-linux-arm64-cpu-0.14.4.tar.gz',
    url: 'https://github.com/VOICEVOX/voicevox_engine/releases/download/0.14.4/voicevox_engine-linux-arm64-cpu-0.14.4.tar.gz',
    sha256: '5a28b08709594f86be2e105e1fc76a2632bcf1b50e41f71df11b212f71887019',
    strip: 1,
  },
  'win32-x64': {
    version: '0.14.4',
    filename: 'voicevox_engine-windows-cpu-0.14.4.zip',
    url: 'https://github.com/VOICEVOX/voicevox_engine/releases/download/0.14.4/voicevox_engine-windows-cpu-0.14.4.zip',
    sha256: '3a18a939f8f260bc3911c4701fb6dfb05d15bc3dc7e7a858ffaa26d0fa1d8e13',
  },
  'darwin-arm64': {
    version: '0.14.4',
    filename: 'voicevox_engine-osx-arm64-cpu-0.14.4.zip',
    url: 'https://github.com/VOICEVOX/voicevox_engine/releases/download/0.14.4/voicevox_engine-osx-arm64-cpu-0.14.4.zip',
    sha256: '49e9cb7ce5fcf5f74780287e0766324a35071a941bf2806371cb14b30e014902',
  },
  'darwin-x64': {
    version: '0.14.4',
    filename: 'voicevox_engine-osx-x64-cpu-0.14.4.zip',
    url: 'https://github.com/VOICEVOX/voicevox_engine/releases/download/0.14.4/voicevox_engine-osx-x64-cpu-0.14.4.zip',
    sha256: 'bf1c50e4b8efeaae137ecb9d0dc6a41f6eefc4343aa104d49a6cf71659a8c084',
  },
};

export async function computeFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex').toLowerCase();
}

export async function verifyArchiveIntegrity(filePath: string, expectedSha256: string): Promise<boolean> {
  if (!expectedSha256 || expectedSha256.length !== 64) {
    throw new Error('A valid 64-character hex SHA-256 hash is required for binary verification');
  }
  const actualHash = await computeFileSha256(filePath);
  return actualHash === expectedSha256.toLowerCase();
}

export async function secureExtractZip(zipPath: string, targetDir: string): Promise<void> {
  const resolvedTarget = resolve(targetDir);
  await fsPromises.mkdir(resolvedTarget, { recursive: true });
  const canonicalTarget = await fsPromises.realpath(resolvedTarget);

  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return rejectPromise(err || new Error('Failed to open zip archive'));
      }

      let canceled = false;
      const fail = (error: any) => {
        if (!canceled) {
          canceled = true;
          try {
            zipfile.close();
          } catch {}
          rejectPromise(error);
        }
      };

      zipfile.on('error', (e) => fail(e));

      zipfile.on('entry', async (entry) => {
        if (canceled) return;

        try {
          if (entry.fileName.startsWith('__MACOSX/') || entry.fileName.includes('/__MACOSX/')) {
            zipfile.readEntry();
            return;
          }

          // Path traversal defense (Zip Slip defense)
          const destPath = resolve(canonicalTarget, entry.fileName);
          const rel = relative(canonicalTarget, destPath);
          if (rel.startsWith('..') || isAbsolute(rel)) {
            throw new Error(`Path traversal attempt detected in zip entry: "${entry.fileName}"`);
          }

          const mode = (entry.externalFileAttributes >> 16) & 0xffff;
          const IFLNK = 40960;
          const IFDIR = 16384;
          const isSymlink = (mode & 61440) === IFLNK;
          const isDir = (mode & 61440) === IFDIR || entry.fileName.endsWith('/');

          if (isDir) {
            await fsPromises.mkdir(destPath, { recursive: true });
            zipfile.readEntry();
            return;
          }

          // Ensure parent directory exists and is strictly contained within canonicalTarget
          const parentDir = dirname(destPath);
          await fsPromises.mkdir(parentDir, { recursive: true });
          const realParent = await fsPromises.realpath(parentDir);
          const parentRel = relative(canonicalTarget, realParent);
          if (parentRel.startsWith('..') || isAbsolute(parentRel)) {
            throw new Error(`Zip entry destination escapes extraction directory: "${entry.fileName}"`);
          }

          zipfile.openReadStream(entry, async (streamErr, readStream) => {
            if (streamErr || !readStream) {
              return fail(streamErr || new Error(`Failed to read entry: ${entry.fileName}`));
            }

            try {
              if (isSymlink) {
                const chunks: Buffer[] = [];
                for await (const chunk of readStream) {
                  chunks.push(Buffer.from(chunk));
                }
                const linkTarget = Buffer.concat(chunks).toString('utf8');
                // Validate that symlink target stays strictly inside extraction root
                const resolvedLink = resolve(parentDir, linkTarget);
                const linkRel = relative(canonicalTarget, resolvedLink);
                if (linkRel.startsWith('..') || isAbsolute(linkRel)) {
                  throw new Error(`Symlink escapes target directory: "${entry.fileName}" -> "${linkTarget}"`);
                }
                await fsPromises.symlink(linkTarget, destPath);
              } else {
                const procMode = (mode & 0o777) || 0o644;
                const writeStream = createWriteStream(destPath, { mode: procMode });
                await pipeline(readStream, writeStream);
              }

              if (!canceled) {
                zipfile.readEntry();
              }
            } catch (writeErr) {
              fail(writeErr);
            }
          });
        } catch (procErr) {
          fail(procErr);
        }
      });

      zipfile.on('close', () => {
        if (!canceled) {
          resolvePromise();
        }
      });

      zipfile.readEntry();
    });
  });
}

export interface VoicevoxEngineManagerOptions {
  baseDir?: string;
  pinnedAssets?: Record<string, PinnedVoicevoxAsset>;
}

export class VoicevoxEngineManager {
  private engineProcess: ChildProcess | null = null;
  private readonly targetDir: string;
  private readonly pinnedAssets: Record<string, PinnedVoicevoxAsset>;

  constructor(options?: string | VoicevoxEngineManagerOptions) {
    const baseDir = typeof options === 'string' ? options : options?.baseDir;
    this.pinnedAssets = (typeof options === 'object' && options?.pinnedAssets)
      ? options.pinnedAssets
      : DEFAULT_PINNED_VOICEVOX_RELEASE;

    this.targetDir = join(baseDir || os.homedir(), '.voicevox');
    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }
  }

  getPlatformKey(): string {
    return `${os.platform()}-${os.arch()}`;
  }

  getPinnedAsset(): PinnedVoicevoxAsset {
    const key = this.getPlatformKey();
    const asset = this.pinnedAssets[key];
    if (!asset) {
      throw new Error(`Unsupported or unpinned platform architecture: ${key}`);
    }
    return asset;
  }

  /**
   * Return the cryptographically pinned download URL for the host platform.
   */
  async getLatestDownloadUrl(): Promise<string> {
    return this.getPinnedAsset().url;
  }

  /**
   * Downloads, cryptographically verifies, and extracts the engine if not already installed.
   */
  async ensureInstalled(onProgress?: (msg: string) => void): Promise<string> {
    const executableName = os.platform() === 'win32' ? 'run.exe' : 'run';
    const engineDir = join(this.targetDir, 'engine');
    const exePath = join(engineDir, executableName);

    if (existsSync(exePath)) {
      onProgress?.('Voicevox engine is already installed.');
      return exePath;
    }

    const asset = this.getPinnedAsset();
    onProgress?.(`Locating pinned Voicevox engine (version: ${asset.version})...`);

    const isZip = asset.filename.endsWith('.zip');
    const tmpFile = join(this.targetDir, `download-${Date.now()}.${isZip ? 'zip' : 'tar.gz'}`);

    onProgress?.(`Downloading pinned binary from ${asset.url}...`);
    const res = await fetch(asset.url);
    if (!res.ok || (!res.body && typeof (res as any).arrayBuffer !== 'function')) {
      throw new Error(`Failed to download pinned asset: ${res.statusText}`);
    }

    const fileStream = createWriteStream(tmpFile);
    const { Readable } = await import('node:stream');
    let readableSource: any;
    if (typeof (res.body as any)?.pipe === 'function') {
      readableSource = res.body;
    } else if (typeof (res as any).arrayBuffer === 'function') {
      const buffer = Buffer.from(await res.arrayBuffer());
      readableSource = Readable.from(buffer);
    } else {
      readableSource = Readable.fromWeb(res.body as any);
    }
    await pipeline(readableSource, fileStream);

    onProgress?.('Verifying cryptographic SHA-256 integrity...');
    const isValid = await verifyArchiveIntegrity(tmpFile, asset.sha256);
    if (!isValid) {
      const actualHash = await computeFileSha256(tmpFile);
      rmSync(tmpFile, { force: true });
      throw new Error(
        `Security verification failed for ${asset.filename}: ` +
        `Expected SHA-256 [${asset.sha256}], but received [${actualHash}]. ` +
        `Binary execution aborted and downloaded file removed.`
      );
    }
    onProgress?.('Cryptographic integrity check passed.');

    onProgress?.('Extracting engine...');
    if (isZip) {
      await secureExtractZip(tmpFile, engineDir);
    } else {
      mkdirSync(engineDir, { recursive: true });
      await tar.x({
        file: tmpFile,
        cwd: engineDir,
        strip: asset.strip ?? 1,
      });
    }

    // Clean up temporary download file
    rmSync(tmpFile, { force: true });

    onProgress?.('Voicevox engine installed and verified successfully.');
    return exePath;
  }

  /**
   * Starts the Voicevox engine and waits for it to be healthy.
   */
  async startEngine(exePath: string, port = 50021): Promise<void> {
    if (this.engineProcess) {
      return;
    }

    this.engineProcess = spawn(exePath, ['--port', port.toString(), '--host', '127.0.0.1'], {
      cwd: join(exePath, '..'),
      stdio: 'ignore',
      detached: true,
    });

    this.engineProcess.unref();

    // Health check
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`http://127.0.0.1:${port}/version`);
          if (res.ok) {
            clearInterval(interval);
            resolve();
          }
        } catch (e) {
          if (attempts > 30) {
            clearInterval(interval);
            reject(new Error('Voicevox engine failed to start within 30 seconds.'));
          }
        }
      }, 1000);
    });
  }

  stopEngine(): void {
    if (this.engineProcess) {
      this.engineProcess.kill('SIGTERM');
      this.engineProcess = null;
    }
  }
}
