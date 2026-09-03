import { join } from 'node:path';
import { existsSync, mkdirSync, createWriteStream, rmSync } from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import extractZip from 'extract-zip';
import tar from 'tar';
// node-fetch v3 is ESM only, we use dynamic import if needed or just global fetch

export class VoicevoxEngineManager {
  private engineProcess: ChildProcess | null = null;
  private readonly targetDir: string;
  private readonly engineUrl = 'https://api.github.com/repos/VOICEVOX/voicevox_engine/releases/latest';

  constructor(baseDir?: string) {
    this.targetDir = join(baseDir || os.homedir(), '.voicevox');
    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }
  }

  /**
   * Determine the right asset based on OS and Architecture.
   */
  private getAssetPattern(): RegExp {
    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'win32') {
      return arch === 'x64' ? /windows-x64-cpu.*\.zip/i : /windows-x86-cpu.*\.zip/i;
    } else if (platform === 'darwin') {
      return arch === 'arm64' ? /osx-arm64-cpu.*\.zip/i : /osx-x64-cpu.*\.zip/i;
    } else if (platform === 'linux') {
      return arch === 'arm64' ? /linux-arm64-cpu.*\.tar\.gz/i : /linux-x64-cpu.*\.tar\.gz/i;
    }

    throw new Error(`Unsupported platform: ${platform} ${arch}`);
  }

  /**
   * Fetches the latest release from GitHub and returns the download URL for the matched asset.
   */
  async getLatestDownloadUrl(): Promise<string> {
    const res = await fetch(this.engineUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch latest voicevox_engine release: ${res.statusText}`);
    }

    const release = await res.json() as any;
    const pattern = this.getAssetPattern();

    const asset = release.assets?.find((a: any) => pattern.test(a.name));
    if (!asset) {
      throw new Error('No compatible voicevox_engine asset found for this platform.');
    }

    return asset.browser_download_url;
  }

  /**
   * Downloads and extracts the engine if not already installed.
   */
  async ensureInstalled(onProgress?: (msg: string) => void): Promise<string> {
    const executableName = os.platform() === 'win32' ? 'run.exe' : 'run';
    const checkPath = join(this.targetDir, 'voicevox_engine', executableName);
    
    // Check if run.exe or run exists inside a nested directory, 
    // but typically it extracts into a folder like voicevox_engine-windows-x64-cpu
    // Let's just assume we will extract directly into this.targetDir/engine
    const engineDir = join(this.targetDir, 'engine');
    const exePath = join(engineDir, executableName);

    if (existsSync(exePath)) {
      onProgress?.('Voicevox engine is already installed.');
      return exePath;
    }

    onProgress?.('Fetching latest Voicevox engine metadata...');
    const url = await this.getLatestDownloadUrl();
    const isZip = url.endsWith('.zip');
    
    const tmpFile = join(this.targetDir, `download.${isZip ? 'zip' : 'tar.gz'}`);
    
    onProgress?.(`Downloading ${url}... (this may take a few minutes)`);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download asset: ${res.statusText}`);
    }

    // Using fetch body as a Web Stream, converting to Node stream for pipeline
    const fileStream = createWriteStream(tmpFile);
    const { Readable } = await import('node:stream');
    await pipeline(Readable.fromWeb(res.body as any), fileStream);

    onProgress?.('Extracting engine...');
    
    if (isZip) {
      await extractZip(tmpFile, { dir: engineDir });
    } else {
      mkdirSync(engineDir, { recursive: true });
      await tar.x({
        file: tmpFile,
        cwd: engineDir,
        strip: 1 // usually extracts voicevox_engine-linux-x64-cpu/run
      });
    }

    // Clean up
    rmSync(tmpFile, { force: true });
    
    onProgress?.('Voicevox engine installed successfully.');
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
      cwd: join(exePath, '..'), // Run in the extracted directory
      stdio: 'ignore', // Do not block Node.js event loop with stdout
      detached: true // Allow it to keep running if Siduri restarts (optional)
    });

    // Unref so the child process doesn't prevent Node from exiting
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
