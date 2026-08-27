import fs from 'node:fs';
import path from 'node:path';
import { OrganManifest, validateOrganManifest } from './manifest';

export class OrganRegistry {
  private manifests: Map<string, OrganManifest> = new Map();

  constructor(manifests?: OrganManifest[]) {
    if (manifests) {
      for (const m of manifests) {
        this.manifests.set(m.organType, m);
      }
    }
  }

  register(manifest: OrganManifest): void {
    const validated = validateOrganManifest(manifest);
    this.manifests.set(validated.organType, validated);
  }

  get(organType: string): OrganManifest | undefined {
    return this.manifests.get(organType);
  }

  getAll(): OrganManifest[] {
    return Array.from(this.manifests.values());
  }

  getAvailableOrganTypes(): string[] {
    return Array.from(this.manifests.keys());
  }

  /**
   * Discover installed or monorepo organ packages.
   */
  static discover(searchRoots?: string[]): OrganRegistry {
    const registry = new OrganRegistry();
    const rootsToScan = searchRoots && searchRoots.length > 0
      ? searchRoots
      : [
          // 1. Monorepo organs folder relative to cli
          path.resolve(__dirname, '../../packages/organs'),
          // 2. Monorepo organs folder relative to cwd
          path.resolve(process.cwd(), 'packages/organs'),
          // 3. Node modules of current directory or global resolution
          path.resolve(process.cwd(), 'node_modules/@siduri'),
          path.resolve(__dirname, '../node_modules/@siduri'),
        ];

    const visitedDirs = new Set<string>();

    for (const root of rootsToScan) {
      if (!fs.existsSync(root) || visitedDirs.has(root)) continue;
      visitedDirs.add(root);

      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const candidateDir = path.join(root, entry.name);
          const manifestPath = path.join(candidateDir, 'organ-manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              const manifest = validateOrganManifest(raw, manifestPath);
              registry.register(manifest);
            } catch (err: any) {
              console.warn(`[Siduri CLI] Warning: failed to parse manifest at ${manifestPath}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        // Continue scanning other roots
      }
    }

    return registry;
  }
}
