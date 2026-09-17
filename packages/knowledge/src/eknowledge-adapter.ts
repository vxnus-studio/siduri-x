import { KnowledgeItem, KnowledgeOrgan } from '@siduri-x/core';
import type { LoadedPack } from '@vxnus/e-knowledge';
import type { KnowledgeProvider, RetrievalResult, KnowledgePackManifest, RetrievalRequest, RetrievalResponse } from '@vxnus/e';
import { Agent, Dispatcher, Dispatcher1Wrapper } from 'undici';
import net from 'node:net';
import dns from 'node:dns/promises';
import nodeDns from 'node:dns';

type EKnowledgeModule = typeof import('@vxnus/e-knowledge');
const loadEKnowledgeModule = (): Promise<EKnowledgeModule> =>
  new Function('specifier', 'return import(specifier)')('@vxnus/e-knowledge') as Promise<EKnowledgeModule>;

export interface EKnowledgeConfig {
  provider?: 'e-knowledge' | 'e-remote' | 'e-hub';
  packPath?: string;
  baseUrl?: string;
  registryUrl?: string;
  packId?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  preferredMode?: 'lexical' | 'semantic' | 'hybrid';
}

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024; // 1MB

/**
 * Validates whether an IP address belongs to loopback, private, link-local, or cloud metadata ranges.
 */
export function isBlockedIp(ip: string): boolean {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private RFC1918)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private RFC1918)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private RFC1918)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // :: (Unspecified)
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    if (normalized.startsWith('::ffff:')) {
      const v4Part = normalized.slice(7);
      if (net.isIPv4(v4Part)) return isBlockedIp(v4Part);
    }
    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // fc00::/7 (Unique local / ULA)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    return false;
  }

  // Non-IP string is invalid
  return true;
}

export interface SafeUrlValidationOptions {
  dnsLookup?: (hostname: string) => Promise<string[]>;
}

/**
 * Validates a destination URL against SSRF rules:
 * - Scheme must be http: or https:
 * - Host must not resolve to blocked IP addresses
 */
export async function validateSafeUrl(urlStr: string, options: SafeUrlValidationOptions = {}): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL provided: ${urlStr}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http: and https: are allowed.`);
  }

  let hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('URL hostname is required');
  }

  // Strip IPv6 brackets if present in hostname (e.g. "[::1]" -> "::1")
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // If hostname is already an IP address
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error(`Blocked destination IP address: ${hostname}`);
    }
    return parsed;
  }

  // Resolve hostname via DNS
  let addresses: string[];
  try {
    if (options.dnsLookup) {
      addresses = await options.dnsLookup(hostname);
    } else {
      const res = await dns.lookup(hostname, { all: true });
      addresses = res.map(r => r.address);
    }
  } catch (err: any) {
    throw new Error(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No DNS records found for hostname: ${hostname}`);
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new Error(`Hostname "${hostname}" resolved to blocked IP address: ${addr}`);
    }
  }

  return parsed;
}

/**
 * Creates an undici Dispatcher configured to enforce connect-time SSRF defenses,
 * neutralizing DNS rebinding and TOCTOU attacks at socket creation time.
 * Wrapped in Dispatcher1Wrapper to support both legacy v1 handlers (Node.js 22 built-in fetch)
 * and v2 handlers.
 */
export function createSafeDispatcher(customLookup?: (hostname: string) => Promise<string[]>): Dispatcher {
  const agent = new Agent({
    connect: {
      lookup: (hostname: string, options: any, callback: any) => {
        if (net.isIP(hostname)) {
          if (isBlockedIp(hostname)) {
            return callback(new Error(`Connect-time blocked destination IP address: ${hostname}`));
          }
          if (options?.all) {
            return callback(null, [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }]);
          }
          return callback(null, hostname, net.isIPv4(hostname) ? 4 : 6);
        }

        if (customLookup) {
          customLookup(hostname)
            .then((addresses) => {
              if (!addresses || addresses.length === 0) {
                return callback(new Error(`No DNS records found for hostname: ${hostname}`));
              }
              for (const addr of addresses) {
                if (isBlockedIp(addr)) {
                  return callback(new Error(`Connect-time hostname "${hostname}" resolved to blocked IP address: ${addr}`));
                }
              }
              if (options?.all) {
                return callback(null, addresses.map((a) => ({ address: a, family: net.isIPv4(a) ? 4 : 6 })));
              }
              return callback(null, addresses[0], net.isIPv4(addresses[0]) ? 4 : 6);
            })
            .catch((err) => callback(err));
          return;
        }

        nodeDns.lookup(hostname, options, (err: any, addresses: any, family: any) => {
          if (err) return callback(err);
          if (options?.all && Array.isArray(addresses)) {
            for (const item of addresses) {
              if (isBlockedIp(item.address)) {
                return callback(new Error(`Connect-time hostname "${hostname}" resolved to blocked IP address: ${item.address}`));
              }
            }
            return callback(null, addresses);
          }
          if (typeof addresses === 'string') {
            if (isBlockedIp(addresses)) {
              return callback(new Error(`Connect-time hostname "${hostname}" resolved to blocked IP address: ${addresses}`));
            }
            return callback(null, addresses, family);
          }
          callback(null, addresses, family);
        });
      },
    },
  });

  return new Dispatcher1Wrapper(agent);
}

/**
 * Safe fetch wrapper that enforces:
 * 1. Target URL validation (SSRF defense)
 * 2. Connect-time DNS validation via undici Dispatcher (anti-DNS rebinding / TOCTOU)
 * 3. Manual redirect following with re-validation of each redirect target
 * 4. Timeout via AbortController
 * 5. Maximum response size limit
 */
export async function safeFetch(
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    dnsLookup?: (hostname: string) => Promise<string[]>;
    dispatcher?: Dispatcher;
  } = {}
): Promise<Response> {
  let currentUrl = urlStr;
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const rawDispatcher = options.dispatcher || createSafeDispatcher(options.dnsLookup);
  const dispatcher = rawDispatcher instanceof Dispatcher1Wrapper ? rawDispatcher : new Dispatcher1Wrapper(rawDispatcher as any);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const validated = await validateSafeUrl(currentUrl, { dnsLookup: options.dnsLookup });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(validated.toString(), {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        redirect: 'manual',
        dispatcher,
      } as any);

      // Handle Redirects safely
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`HTTP ${response.status} redirect missing Location header`);
        }
        if (redirectCount >= maxRedirects) {
          throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
        }
        currentUrl = new URL(location, validated).toString();
        continue;
      }

      // Check Content-Length header if present
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(contentLength) && contentLength > maxBytes) {
          throw new Error(`Response size (${contentLength} bytes) exceeds limit of ${maxBytes} bytes`);
        }
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Too many redirects');
}

export async function readBoundedResponseText(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  const contentLengthHeader = response?.headers?.get ? response.headers.get('content-length') : null;
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Response Content-Length (${declaredLength} bytes) exceeds maximum allowed ${maxBytes} bytes`);
    }
  }

  if (response.body && typeof (response.body as any).getReader === 'function') {
    const reader = (response.body as any).getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > maxBytes) {
            await reader.cancel();
            throw new Error(`Response stream exceeded maximum allowed size of ${maxBytes} bytes`);
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const merged = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  // Fallback for mock responses or environments without getReader()
  const text = await response.text();
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxBytes) {
    throw new Error(`Response body length (${byteLength} bytes) exceeds maximum allowed ${maxBytes} bytes`);
  }
  return text;
}

export async function safeFetchJson<T>(
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const response = await safeFetch(urlStr, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Stream-read response with strict byte bounding to prevent memory exhaustion
  const text = await readBoundedResponseText(response as any, maxBytes);

  try {
    return JSON.parse(text) as T;
  } catch (err: any) {
    throw new Error(`Failed to parse JSON response: ${err.message}`);
  }
}

async function resolveManifest(provider: KnowledgeProvider, baseUrl: string, timeoutMs?: number, maxBytes?: number): Promise<KnowledgePackManifest> {
  if (typeof provider.manifest === 'function') {
    return await provider.manifest();
  }
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  return await safeFetchJson<KnowledgePackManifest>(`${cleanUrl}/manifest`, {
    headers: { accept: 'application/json' },
    timeoutMs: timeoutMs || 5000,
    maxBytes,
  });
}

async function resolveHubProvider(config: EKnowledgeConfig, module: EKnowledgeModule): Promise<{ provider: KnowledgeProvider; baseUrl: string; manifest?: KnowledgePackManifest }> {
  if (!config.registryUrl || !config.packId) throw new Error('E Hub provider requires registryUrl and packId');
  const match = config.packId.match(/^@([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('E Hub packId must use the @publisher/name format');
  const registryUrl = config.registryUrl.replace(/\/+$/, '');
  const hubPackUrl = `${registryUrl}/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`;
  
  const pack = await safeFetchJson<KnowledgePackManifest & { distribution?: { kind?: string; url?: string } }>(hubPackUrl, {
    timeoutMs: config.timeoutMs,
    maxBytes: config.maxResponseBytes,
  });

  if (pack.distribution?.kind !== 'provider' || !pack.distribution.url) {
    throw new Error(`E Hub pack ${config.packId} is not a remote provider`);
  }
  const baseUrl = pack.distribution.url;
  // Validate distribution URL against SSRF
  await validateSafeUrl(baseUrl);

  return {
    provider: module.createRemoteProvider({ baseUrl, timeoutMs: config.timeoutMs, manifest: pack }),
    baseUrl,
    manifest: pack,
  };
}

export class EKnowledgeAdapter implements KnowledgeOrgan {
  private loaded: Promise<LoadedPack | { provider: KnowledgeProvider & { retrieve: (request: RetrievalRequest) => Promise<RetrievalResponse> }; manifest: KnowledgePackManifest; baseUrl?: string }>;
  private readonly preferredMode: EKnowledgeConfig['preferredMode'];
  private readonly timeoutMs?: number;
  private readonly maxResponseBytes?: number;

  constructor(config: EKnowledgeConfig) {
    this.preferredMode = config.preferredMode ?? 'lexical';
    this.timeoutMs = config.timeoutMs;
    this.maxResponseBytes = config.maxResponseBytes;
    this.loaded = loadEKnowledgeModule().then(async (module) => {
      if (config.provider === 'e-hub') {
        const { provider, baseUrl, manifest: hubManifest } = await resolveHubProvider(config, module);
        let manifest: KnowledgePackManifest;
        try {
          const resolved = await resolveManifest(provider, baseUrl, config.timeoutMs);
          manifest = { ...hubManifest, ...resolved, apiContract: (resolved as any)?.apiContract || (hubManifest as any)?.apiContract };
        } catch {
          if (!hubManifest) throw new Error('Could not resolve manifest for E Hub provider');
          manifest = hubManifest;
        }
        return { provider: provider as any, manifest, baseUrl };
      }
      if (config.provider === 'e-remote' || config.baseUrl) {
        const baseUrl = config.baseUrl || '';
        const provider = module.createRemoteProvider({ baseUrl, timeoutMs: config.timeoutMs });
        let manifest: KnowledgePackManifest;
        try {
          manifest = await resolveManifest(provider, baseUrl, config.timeoutMs);
        } catch {
          // As per E RFC, remote providers are not required to serve a /manifest endpoint.
          // Fall back to a lightweight synthesized manifest so retrieval remains functional.
          manifest = {
            id: config.packId || 'remote-provider',
            name: config.packId || 'remote-provider',
            publisher: 'remote',
            version: '1.0.0',
            capabilities: {
              lexicalSearch: true,
              semanticSearch: false,
              revisions: false,
            },
          } as KnowledgePackManifest;
        }
        return { provider: provider as any, manifest, baseUrl };
      }
      if (!config.packPath) throw new Error('EKnowledgeAdapter requires packPath, baseUrl, or E Hub configuration');
      return module.loadPack(config.packPath);
    }).catch((err) => {
      console.warn(`[EKnowledgeAdapter] Warning: Knowledge pack initialization failed: ${err.message}`);
      throw err;
    });
    // Prevent unhandled rejection crashes on startup
    this.loaded.catch(() => {});
  }

  get currentRevision() {
    return this.loaded
      .then(pack => 'revision' in pack ? pack.revision.id : 'remote')
      .catch(() => 'unavailable');
  }

  async search(query: string): Promise<KnowledgeItem[]> {
    let pack;
    try {
      pack = await this.loaded;
    } catch {
      return [];
    }
    if (!query.trim()) return [];
    const requestedMode = this.preferredMode;
    const manifest = pack.manifest;
    const modeSupported = requestedMode === 'lexical' || manifest.capabilities.semanticSearch;
    let response;
    try {
      response = await pack.provider.retrieve!({ query, mode: modeSupported ? requestedMode : 'lexical', limit: 8 });
    } catch (error) {
      if (requestedMode !== 'lexical') {
        try {
          response = await pack.provider.retrieve!({ query, mode: 'lexical', limit: 8 });
        } catch (innerError) {
          // Fall through to REST fallback
        }
      }
      if (!response && 'baseUrl' in pack && pack.baseUrl) {
        try {
          response = await this.fallbackRestSearch(pack.baseUrl, query, manifest, this.timeoutMs, this.maxResponseBytes);
        } catch {
          // Both SDK retrieve and REST fallback failed
          throw error;
        }
      } else if (!response) {
        throw error;
      }
    }
    return response.results.map((result: RetrievalResult) => ({
      id: result.id,
      content: result.content,
      revision: result.revision,
      citations: result.citations,
      provenance: result.citations[0]?.sourceId || pack.manifest.publisher
    }));
  }

  private extractOpenApiEndpoints(apiContract: any): Array<{
    path: string;
    operationId?: string;
    summary: string;
    description: string;
    tags: string[];
    parameters: Array<{ in: string; name: string; required?: boolean }>;
  }> {
    const paths = apiContract?.paths || {};
    const endpoints: any[] = [];
    for (const [p, methods] of Object.entries(paths)) {
      if (!methods || typeof methods !== 'object') continue;
      for (const [m, op] of Object.entries(methods as any)) {
        if (m.toLowerCase() !== 'get') continue;
        if (p.includes('/health') || p.includes('/verify') || p.includes('openapi') || p.includes('/mcp')) continue;
        const opObj = op as any;
        endpoints.push({
          path: p,
          operationId: opObj.operationId,
          summary: opObj.summary || '',
          description: opObj.description || '',
          tags: Array.isArray(opObj.tags) ? opObj.tags : [],
          parameters: Array.isArray(opObj.parameters) ? opObj.parameters : [],
        });
      }
    }
    return endpoints;
  }

  private resolveOpenApiCall(q: string, ep: any, originUrl: string): string | null {
    const pathParams = (ep.parameters || []).filter((p: any) => p.in === 'path');
    let resolvedPath = ep.path;

    if (pathParams.length > 0) {
      const descWords = new Set(
        `${ep.path} ${ep.summary} ${ep.tags.join(' ')}`
          .toLowerCase()
          .replace(/[{}]/g, ' ')
          .split(/[^a-z0-9]+/)
          .filter((w: string) => w.length > 2)
      );
      const stopWords = new Set([
        'who', 'what', 'where', 'when', 'how', 'is', 'was', 'are', 'were',
        'she', 'he', 'they', 'the', 'a', 'an', 'in', 'on', 'to', 'for', 'of',
        'tell', 'about', 'banner', 'banners', 'wish', 'wishes', 'rerun', 'reruns',
        'pull', 'pulls', 'phase', 'rateup', 'history', 'build', 'builds', 'guide', 'guides'
      ]);

      const queryTokens = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const candidateTokens = queryTokens.filter((t) => !descWords.has(t) && !stopWords.has(t));

      if (candidateTokens.length === 0) return null;
      const slug = candidateTokens.join('-');

      for (const pp of pathParams) {
        resolvedPath = resolvedPath.replace(`{${pp.name}}`, slug);
      }
      if (resolvedPath.includes('{')) return null;
      return `${originUrl}${resolvedPath}`;
    }

    const qParam = (ep.parameters || []).find((p: any) => p.in === 'query' && (p.name === 'q' || p.name === 'query'));
    if (qParam) {
      const cleanSearchTokens = q
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => !['banner', 'banners', 'build', 'builds', 'wish', 'wishes'].includes(w) && w.length > 1);
      const cleanSearchQuery = cleanSearchTokens.length > 0 ? cleanSearchTokens.join(' ') : q;
      return `${originUrl}${resolvedPath}?${qParam.name}=${encodeURIComponent(cleanSearchQuery)}&limit=5`;
    }

    return `${originUrl}${resolvedPath}`;
  }

  private formatOpenApiResponse(data: any, ep: any, manifest: KnowledgePackManifest, callUrl: string): RetrievalResult[] {
    if (!data || typeof data !== 'object') return [];
    const results: RetrievalResult[] = [];
    const revision = manifest.version || '1.0.0';
    const sourceId = manifest.id || manifest.name || '@vxnus/knowledge-pack';

    const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : null;
    if (items) {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if (!item || typeof item !== 'object') continue;
        const id = item.id || item.entity_id || item.entityId || item.slug || `${ep.path}:${idx}`;
        const title = item.title || item.name || item.section || '';
        const body = item.content || item.snippet || item.description || '';
        let content = '';
        if (title && body && !body.startsWith(title)) {
          content = `${title}: ${body}`;
        } else if (body) {
          content = body;
        } else if (title) {
          content = title;
        } else {
          content = JSON.stringify(item);
        }
        results.push({
          id: String(id),
          content,
          revision,
          citations: [
            {
              sourceId,
              documentId: String(item.slug || item.entitySlug || id),
              chunkId: String(id),
              locator: callUrl,
            },
          ],
        });
      }
      return results;
    }

    const summaryTitle = ep.summary || ep.path;
    const textLines: string[] = [`[${summaryTitle}]`];

    if (data.character && typeof data.character === 'object') {
      const cName = data.character.name || data.character.id;
      textLines.push(`Subject: ${cName} (${data.character.rarity ? data.character.rarity + '★' : ''})`);
    }
    if (Array.isArray(data.appearances)) {
      textLines.push(`Total Appearances: ${data.appearances.length}`);
      for (const a of data.appearances) {
        textLines.push(`  • Version ${a.version} Phase ${a.phaseNumber || 1} (${a.phaseKey || ''}): ${a.startDate || ''} to ${a.endDate || ''}`);
      }
    }
    if (data.currentWait !== undefined) {
      textLines.push(`Current Wait: ${data.currentWait} phases`);
    }
    if (data.analysis && typeof data.analysis === 'object') {
      textLines.push(`Analysis: ${data.analysis.summary || ''}`);
      if (data.analysis.pressureScore !== undefined && data.analysis.pressureScore !== null) {
        textLines.push(`Pressure Score: ${data.analysis.pressureScore} [${data.analysis.pressureLevel || ''}]`);
      }
    }
    if (Array.isArray(data.builds)) {
      for (const b of data.builds) {
        textLines.push(`Role: ${b.role || ''} - ${b.title || ''}`);
        if (Array.isArray(b.weapons)) {
          textLines.push(`  Weapons: ${b.weapons.map((w: any) => w.name || w).join(', ')}`);
        }
        if (Array.isArray(b.artifacts)) {
          textLines.push(`  Artifacts: ${b.artifacts.map((a: any) => a.name || a).join(', ')}`);
        }
      }
    }
    if (Array.isArray(data.characters)) {
      if (data.currentPhase) textLines.push(`Current Phase: ${data.currentPhase.phaseKey || ''}`);
      for (const c of data.characters.slice(0, 5)) {
        textLines.push(`  • ${c.name}: ${c.currentWait} phases wait (pressure: ${c.pressureScore})`);
      }
    }

    if (textLines.length === 1) {
      textLines.push(JSON.stringify(data, null, 2));
    }

    results.push({
      id: `${ep.path}:${callUrl}`,
      content: textLines.join('\n'),
      revision,
      citations: [
        {
          sourceId,
          documentId: ep.operationId || ep.path,
          chunkId: `${ep.path}:${callUrl}`,
          locator: callUrl,
        },
      ],
    });
    return results;
  }

  /**
   * Universal dynamic retrieval for remote knowledge providers.
   * If the pack registered an OpenAPI contract in E Hub (apiContract),
   * dynamically discovers and queries relevant endpoints (search, banner history, builds, etc.).
   * Also maintains backwards compatibility for REST search fallbacks.
   */
  private async fallbackRestSearch(
    baseUrl: string,
    query: string,
    manifest: KnowledgePackManifest,
    timeoutMs?: number,
    maxBytes?: number
  ): Promise<RetrievalResponse> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const originUrl = new URL(cleanUrl).origin;
    const timeout = timeoutMs || 5000;
    const revision = manifest.version || '1.0.0';

    // 1. Dynamic execution via OpenAPI specification contract if present
    const apiContract = (manifest as any).apiContract;
    if (apiContract && typeof apiContract === 'object' && apiContract.paths) {
      const endpoints = this.extractOpenApiEndpoints(apiContract);
      const matchedCalls: Array<{ ep: any; callUrl: string }> = [];

      for (const ep of endpoints) {
        const text = `${ep.path} ${ep.summary} ${ep.description} ${ep.tags.join(' ')}`.toLowerCase();
        const qWords = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
        const hasMatch = qWords.some((w) => text.includes(w));
        const isSearch = (ep.parameters || []).some((p: any) => p.in === 'query' && (p.name === 'q' || p.name === 'query'));

        if (hasMatch || isSearch) {
          const callUrl = this.resolveOpenApiCall(query, ep, originUrl);
          if (callUrl) {
            matchedCalls.push({ ep, callUrl });
          }
        }
      }

      if (matchedCalls.length > 0) {
        const fetchPromises = matchedCalls.map(async ({ ep, callUrl }) => {
          try {
            const data = await safeFetchJson<any>(callUrl, {
              headers: { accept: 'application/json' },
              timeoutMs: timeout,
              maxBytes,
            });
            return this.formatOpenApiResponse(data, ep, manifest, callUrl);
          } catch {
            return [];
          }
        });

        const allResults = (await Promise.all(fetchPromises)).flat();
        if (allResults.length > 0) {
          // Sort results: prioritize specialized/targeted endpoints (e.g. banner history, builds) over broad full-text lists
          allResults.sort((a, b) => {
            const aIsSpecialized = a.content.startsWith('[');
            const bIsSpecialized = b.content.startsWith('[');
            if (aIsSpecialized && !bIsSpecialized) return -1;
            if (!aIsSpecialized && bIsSpecialized) return 1;
            return 0;
          });

          // Deduplicate
          const seen = new Set<string>();
          const deduped: RetrievalResult[] = [];
          for (const res of allResults) {
            if (!seen.has(res.id)) {
              seen.add(res.id);
              deduped.push(res);
            }
          }
          return {
            revision,
            results: deduped,
          };
        }
      }
    }

    // 2. Fallback for standard knowledge search / lore endpoints if no OpenAPI contract matched
    const encoded = encodeURIComponent(query);
    const [loreData, knowData] = await Promise.all([
      safeFetchJson<any>(`${cleanUrl}/v1/lore/search?q=${encoded}&limit=5`, {
        headers: { accept: 'application/json' },
        timeoutMs: timeout,
        maxBytes,
      }).catch(() =>
        safeFetchJson<any>(cleanUrl.replace(/\/api\/e\/?$/, '/api/v1/lore/search') + `?q=${encoded}&limit=5`, {
          headers: { accept: 'application/json' },
          timeoutMs: timeout,
          maxBytes,
        }).catch(() => null)
      ),
      safeFetchJson<any>(`${cleanUrl}/v1/knowledge/search?q=${encoded}&limit=5`, {
        headers: { accept: 'application/json' },
        timeoutMs: timeout,
        maxBytes,
      }).catch(() =>
        safeFetchJson<any>(cleanUrl.replace(/\/api\/e\/?$/, '/api/knowledge/search') + `?q=${encoded}&limit=5`, {
          headers: { accept: 'application/json' },
          timeoutMs: timeout,
          maxBytes,
        }).catch(() => null)
      ),
    ]);

    let rawLoreItems: any[] = Array.isArray(loreData?.items) ? loreData.items : [];
    let rawKnowItems: any[] = Array.isArray(knowData?.items) ? knowData.items : [];

    const combined = [...rawLoreItems, ...rawKnowItems];
    const seen = new Set<string>();
    const deduplicated: any[] = [];

    for (const item of combined) {
      const key = item.id || item.entity_id || item.entityId || item.slug || item.content;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    const results: RetrievalResult[] = deduplicated.map((item, idx) => {
      const id = item.id || item.entity_id || item.entityId || `item-${idx}`;
      const title = item.title || item.name || item.section || '';
      const body = item.content || item.snippet || '';
      const content = title && body && !body.startsWith(title) ? `${title}: ${body}` : (body || title);
      const docSlug = item.entitySlug || item.slug || id;

      return {
        id,
        content,
        revision,
        citations: [
          {
            sourceId: manifest.id || manifest.name || '@vxnus/knowledge-pack',
            documentId: docSlug,
            chunkId: id,
            locator: `${cleanUrl}/v1/lore/search?q=${encoded}`,
          },
        ],
      };
    });

    return {
      revision,
      results,
    };
  }
}
