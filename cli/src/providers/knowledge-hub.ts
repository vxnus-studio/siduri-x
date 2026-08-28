import inquirer from 'inquirer';

export interface KnowledgeHubCapabilities {
  search?: boolean;
  retrieval?: boolean;
  contextInjection?: boolean;
  semanticSearch?: boolean;
  lexicalSearch?: boolean;
  [key: string]: unknown;
}

export interface KnowledgeHubManifest {
  name: string;
  displayName?: string;
  publisher?: string;
  package?: string;
  version: string;
  description?: string;
  capabilities?: KnowledgeHubCapabilities | string[];
  distribution?: {
    kind?: string;
    url?: string;
  };
  source?: string;
  environment?: Array<{
    name: string;
    required?: boolean;
    description?: string;
  }>;
}

export const KNOWN_KNOWLEDGE_PACKS: Record<string, KnowledgeHubManifest> = {
  '@vxnus/e-teyvat': {
    name: 'e-teyvat',
    displayName: 'E Teyvat',
    publisher: 'vxnus',
    package: '@vxnus/e-teyvat',
    version: '1.2.0',
    description: 'Teyvat knowledge provider for Siduri.',
    capabilities: ['Search', 'Retrieval', 'Context injection'],
    distribution: {
      kind: 'provider',
      url: 'https://teyvat.e.vxnus.xyz',
    },
    source: 'E Knowledge Hub',
  },
};

export function validateKnowledgeManifest(raw: unknown, packId?: string): KnowledgeHubManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid knowledge manifest: expected object.`);
  }

  const m = raw as Partial<KnowledgeHubManifest>;
  if (!m.name || typeof m.name !== 'string') {
    throw new Error(`Invalid knowledge manifest: missing 'name' field.`);
  }
  if (!m.version || typeof m.version !== 'string') {
    throw new Error(`Invalid knowledge manifest: missing 'version' field.`);
  }

  return {
    name: m.name,
    displayName: m.displayName || m.name,
    publisher: m.publisher,
    package: m.package || packId || m.name,
    version: m.version,
    description: m.description || 'Knowledge pack provider',
    capabilities: m.capabilities || ['Search', 'Retrieval'],
    distribution: m.distribution,
    source: m.source || 'E Knowledge Hub',
    environment: m.environment || [],
  };
}

export function extractCapabilitiesList(capabilities?: KnowledgeHubCapabilities | string[]): string[] {
  if (!capabilities) {
    return ['Search', 'Retrieval'];
  }
  if (Array.isArray(capabilities)) {
    return capabilities.map((c) => String(c));
  }
  const result: string[] = [];
  if (capabilities.lexicalSearch || capabilities.search) result.push('Search');
  result.push('Retrieval');
  if (capabilities.contextInjection) result.push('Context injection');
  if (capabilities.semanticSearch) result.push('Semantic search');
  if (capabilities.structuredEntities) result.push('Structured entities');
  if (capabilities.relations) result.push('Entity relations');
  if (capabilities.revisions) result.push('Content revisions');

  for (const [key, val] of Object.entries(capabilities)) {
    if (val === true && !['search', 'retrieval', 'contextInjection', 'semanticSearch', 'lexicalSearch', 'structuredEntities', 'relations', 'revisions'].includes(key)) {
      result.push(key);
    }
  }

  return result.length > 0 ? result : ['Search', 'Retrieval'];
}

export class KnowledgeHubClient {
  private registryUrl: string;
  private timeoutMs: number;

  constructor(registryUrl = 'https://e.vxnus.xyz/api/v1/knowledge', timeoutMs = 5000) {
    this.registryUrl = registryUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  async resolveProvider(packId: string): Promise<KnowledgeHubManifest> {
    const trimmed = packId.trim();
    const match = trimmed.match(/^@([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new Error(`Invalid package ID format "${packId}". Expected format: @publisher/name (e.g. @vxnus/e-teyvat)`);
    }

    const publisher = match[1];
    const name = match[2];
    const url = `${this.registryUrl}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        // Check offline/built-in catalog fallback for known pack IDs
        if (KNOWN_KNOWLEDGE_PACKS[trimmed]) {
          return KNOWN_KNOWLEDGE_PACKS[trimmed];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText} for ${packId}`);
      }

      const body = await response.json();
      return validateKnowledgeManifest(body, trimmed);
    } catch (err: any) {
      // If network fails and known pack exists, use fallback
      if (KNOWN_KNOWLEDGE_PACKS[trimmed]) {
        return KNOWN_KNOWLEDGE_PACKS[trimmed];
      }
      throw new Error(`Failed to resolve package "${packId}" from E Knowledge Hub: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function displayKnowledgeProviderSummary(manifest: KnowledgeHubManifest, packId: string): void {
  const cyan = '\u001b[36m';
  const dim = '\u001b[2m';
  const reset = '\u001b[0m';

  console.log(`\n${cyan}── Knowledge Provider ────────────────────────${reset}\n`);
  console.log(`  ${dim}Name:${reset}        ${manifest.displayName || manifest.name}`);
  console.log(`  ${dim}Package:${reset}     ${packId}`);
  console.log(`  ${dim}Version:${reset}     ${manifest.version}`);
  if (manifest.description) {
    console.log(`\n  ${dim}Description:${reset}`);
    console.log(`  ${manifest.description}`);
  }

  const caps = extractCapabilitiesList(manifest.capabilities);
  console.log(`\n  ${dim}Capabilities:${reset}`);
  for (const cap of caps) {
    console.log(`    • ${cap}`);
  }

  console.log(`\n  ${dim}Source:${reset}`);
  console.log(`    ${manifest.source || 'E Knowledge Hub'}\n`);
}
