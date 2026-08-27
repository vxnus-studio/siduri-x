import { KnowledgeItem, KnowledgeOrgan } from '@siduri-x/core';
import type { LoadedPack } from '@vxnus/e-knowledge';
import type { KnowledgeProvider, RetrievalResult, KnowledgePackManifest, RetrievalRequest, RetrievalResponse } from '@vxnus/e';
import net from 'node:net';
import dns from 'node:dns/promises';

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
 * Safe fetch wrapper that enforces:
 * 1. Target URL validation (SSRF defense)
 * 2. Manual redirect following with re-validation of each redirect target
 * 3. Timeout via AbortController
 * 4. Maximum response size limit
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
  } = {}
): Promise<Response> {
  let currentUrl = urlStr;
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const validated = await validateSafeUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(validated.toString(), {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        redirect: 'manual',
      });

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

async function safeFetchJson<T>(
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

  // Read response as text with size limit to prevent memory exhaustion
  const text = await response.text();
  if (text.length > maxBytes) {
    throw new Error(`Response body length (${text.length} chars) exceeds maximum allowed ${maxBytes} bytes`);
  }

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
  private loaded: Promise<LoadedPack | { provider: KnowledgeProvider & { retrieve: (request: RetrievalRequest) => Promise<RetrievalResponse> }; manifest: KnowledgePackManifest }>;
  private readonly preferredMode: EKnowledgeConfig['preferredMode'];

  constructor(config: EKnowledgeConfig) {
    this.preferredMode = config.preferredMode ?? 'lexical';
    this.loaded = loadEKnowledgeModule().then(async (module) => {
      if (config.provider === 'e-hub') {
        const { provider, baseUrl, manifest: hubManifest } = await resolveHubProvider(config, module);
        let manifest: KnowledgePackManifest;
        try {
          manifest = await resolveManifest(provider, baseUrl, config.timeoutMs);
        } catch {
          if (!hubManifest) throw new Error('Could not resolve manifest for E Hub provider');
          manifest = hubManifest;
        }
        return { provider: provider as any, manifest };
      }
      if (config.provider === 'e-remote' || config.baseUrl) {
        const baseUrl = config.baseUrl || '';
        const provider = module.createRemoteProvider({ baseUrl, timeoutMs: config.timeoutMs });
        const manifest = await resolveManifest(provider, baseUrl, config.timeoutMs);
        return { provider: provider as any, manifest };
      }
      if (!config.packPath) throw new Error('EKnowledgeAdapter requires packPath, baseUrl, or E Hub configuration');
      return module.loadPack(config.packPath);
    });
  }

  get currentRevision() { return this.loaded.then(pack => 'revision' in pack ? pack.revision.id : 'remote'); }

  async search(query: string): Promise<KnowledgeItem[]> {
    const pack = await this.loaded;
    if (!query.trim()) return [];
    const requestedMode = this.preferredMode;
    const manifest = pack.manifest;
    const modeSupported = requestedMode === 'lexical' || manifest.capabilities.semanticSearch;
    let response;
    try {
      response = await pack.provider.retrieve!({ query, mode: modeSupported ? requestedMode : 'lexical', limit: 8 });
    } catch (error) {
      if (requestedMode === 'lexical') throw error;
      // Semantic infrastructure is optional: an outage must not remove the
      // provider's cited lexical path.
      response = await pack.provider.retrieve!({ query, mode: 'lexical', limit: 8 });
    }
    return response.results.map((result: RetrievalResult) => ({
      content: result.content,
      revision: result.revision,
      citations: result.citations,
      provenance: result.citations[0]?.sourceId || pack.manifest.publisher
    }));
  }
}
