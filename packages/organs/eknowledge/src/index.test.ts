import { EKnowledgeAdapter, isBlockedIp, validateSafeUrl, safeFetch, createSafeDispatcher, safeFetchJson, readBoundedResponseText } from './index';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
let testPackPath = process.env.E_TEST_PACK_PATH || '';
if (!testPackPath) {
  try {
    const entry = require.resolve('@vxnus/e-knowledge');
    const bundledFixture = path.resolve(path.dirname(entry), '../fixtures/sample');
    if (fs.existsSync(bundledFixture)) {
      testPackPath = bundledFixture;
    }
  } catch {
    // fallback
  }
}
if (!testPackPath) {
  testPackPath = path.resolve(__dirname, '../../../../../e/packages/knowledge/fixtures/sample');
}

describe('EKnowledgeAdapter', () => {
  beforeEach(() => {
    jest.spyOn(dns, 'lookup').mockImplementation(async (hostname: string) => {
      if (hostname.includes('blocked') || hostname.includes('127.0.0.1')) {
        return [{ address: '127.0.0.1', family: 4 }] as any;
      }
      return [{ address: '93.184.216.34', family: 4 }] as any; // public IP
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads an E pack and preserves citations and revision', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: testPackPath });
    const results = await adapter.search('grounded facts');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ content: 'Siduri knowledge packs provide grounded facts.', revision: 'r1' });
    expect(results[0].citations[0]).toMatchObject({ sourceId: 'handbook', documentId: 'intro', chunkId: 'intro-1' });
  });

  test('does not retrieve for an empty query', async () => {
    const adapter = new EKnowledgeAdapter({ packPath: testPackPath });
    expect(await adapter.search('   ')).toEqual([]);
  });

  test('falls back to lexical when semantic capability is unavailable', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const data = url.endsWith('/manifest')
        ? { id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
        : { revision: 'r1', results: [{ id: 'c1', content: 'lexical fallback', revision: 'r1', citations: [{ sourceId: 'gi-data', chunkId: 'c1' }] }] };
      if (!url.endsWith('/manifest')) {
        expect(JSON.parse(String(init?.body)).mode).toBe('lexical');
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data),
        json: async () => data,
        headers: new Headers(),
      } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-remote', baseUrl: 'https://provider.example/api/e', preferredMode: 'semantic' });
    await expect(adapter.search('fallback')).resolves.toMatchObject([{ content: 'lexical fallback' }]);
    fetchMock.mockRestore();
  });

  test('loads an E remote provider and preserves its citation contract', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.endsWith('/manifest')
        ? { id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
        : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'Furina uses materials.', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
        headers: new Headers(),
      } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-remote', baseUrl: 'https://provider.example/api/e' });
    await expect(adapter.search('Furina')).resolves.toMatchObject([{ revision: 'teyvat-r1', provenance: 'gi-data' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/manifest'), expect.anything());
    fetchMock.mockRestore();
  });

  test('resolves a provider distribution through the E Hub', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('/api/packs/publisher/installed-pack')
        ? { distribution: { kind: 'provider', url: 'https://provider.example/api/e' } }
        : url.endsWith('/manifest')
          ? { id: '@publisher/installed-pack', name: 'installed-pack', publisher: 'publisher', version: '1.0.0', schemaVersion: '1.0', sources: [{ id: 'source', title: 'Source', license: 'CC-BY-4.0' }], capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true } }
          : { revision: 'teyvat-r1', results: [{ id: 'chunk-1', content: 'hub fact', revision: 'teyvat-r1', citations: [{ sourceId: 'gi-data', documentId: 'doc-1', chunkId: 'chunk-1' }] }] };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
        headers: new Headers(),
      } as Response;
    });
    const adapter = new EKnowledgeAdapter({ provider: 'e-hub', registryUrl: 'https://hub.example/api/packs', packId: '@publisher/installed-pack' });
    await expect(adapter.search('hub')).resolves.toMatchObject([{ content: 'hub fact', revision: 'teyvat-r1' }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/packs/publisher/installed-pack'), expect.anything());
    fetchMock.mockRestore();
  });
});

describe('SSRF Hardening Suite', () => {
  beforeEach(() => {
    jest.spyOn(dns, 'lookup').mockImplementation(async (hostname: string) => {
      if (hostname.includes('blocked') || hostname.includes('127.0.0.1') || hostname.includes('internal.corp')) {
        return [{ address: '10.0.0.5', family: 4 }] as any;
      }
      return [{ address: '93.184.216.34', family: 4 }] as any; // public IP
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('isBlockedIp identifies private, loopback, link-local, and cloud metadata IPs', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('127.255.255.255')).toBe(true);
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true); // AWS/GCP Metadata
    expect(isBlockedIp('0.0.0.0')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);

    // Public IPs should not be blocked
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('93.184.216.34')).toBe(false);
    expect(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  test('validateSafeUrl rejects non-http schemes and blocked IPs', async () => {
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow(/Forbidden protocol/);
    await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow(/Forbidden protocol/);
    await expect(validateSafeUrl('http://127.0.0.1:8080/manifest')).rejects.toThrow(/Blocked destination IP address/);
    await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/Blocked destination IP address/);
    await expect(validateSafeUrl('http://0.0.0.0/')).rejects.toThrow(/Blocked destination IP address/);
    await expect(validateSafeUrl('http://100.64.0.1/')).rejects.toThrow(/Blocked destination IP address/); // CGNAT
    await expect(validateSafeUrl('http://[::1]/')).rejects.toThrow(/Blocked destination IP address/); // IPv6 loopback
    await expect(validateSafeUrl('http://[fc00::1]/')).rejects.toThrow(/Blocked destination IP address/); // IPv6 ULA
  });

  test('validateSafeUrl rejects hostnames resolving to private IPs', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }] as any);
    await expect(validateSafeUrl('https://internal.corp/manifest')).rejects.toThrow(/resolved to blocked IP address/);
  });

  test('safeFetch rejects open redirects pointing to internal IP addresses', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 302,
      ok: false,
      headers: new Headers({ location: 'http://169.254.169.254/latest/meta-data' }),
      text: async () => '',
    } as Response);

    await expect(safeFetch('https://public.example/redirect')).rejects.toThrow(/Blocked destination IP address/);
    fetchMock.mockRestore();
  });

  test('createSafeDispatcher blocks DNS rebinding / TOCTOU at socket connect time', (done) => {
    const rebindingLookup = async () => ['127.0.0.1'];
    const dispatcher = createSafeDispatcher(rebindingLookup);

    fetch('http://rebound-attack.example:9999', { dispatcher } as any)
      .then(() => done(new Error('Expected connect-time SSRF block')))
      .catch((err) => {
        try {
          expect(err.cause?.message || err.message).toMatch(/Connect-time.*blocked/i);
          done();
        } catch (assertionErr) {
          done(assertionErr);
        }
      });
  });

  test('readBoundedResponseText rejects response exceeding Content-Length header limit', async () => {
    const mockResponse = {
      headers: new Headers({ 'content-length': '2048' }),
      body: null,
      text: async () => 'small text',
    } as any;

    await expect(readBoundedResponseText(mockResponse, 1024)).rejects.toThrow(
      /Response Content-Length \(2048 bytes\) exceeds maximum allowed 1024 bytes/
    );
  });

  test('readBoundedResponseText cancels stream and rejects when stream exceeds maxBytes', async () => {
    let cancelCalled = false;
    let readCount = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(async () => {
        readCount++;
        if (readCount === 1) {
          return { done: false, value: new TextEncoder().encode('12345') };
        }
        if (readCount === 2) {
          return { done: false, value: new TextEncoder().encode('6789012345') }; // exceeds 10 bytes
        }
        return { done: true, value: undefined };
      }),
      cancel: jest.fn().mockImplementation(async () => {
        cancelCalled = true;
      }),
      releaseLock: jest.fn(),
    };

    const mockResponse = {
      headers: new Headers(),
      body: {
        getReader: () => mockReader,
      },
    } as any;

    await expect(readBoundedResponseText(mockResponse, 10)).rejects.toThrow(
      /Response stream exceeded maximum allowed size of 10 bytes/
    );
    expect(cancelCalled).toBe(true);
  });

  test('safeFetchJson successfully parses bounded responses within limit', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '23' }),
      text: async () => '{"status":"ok","id":42}',
    } as Response);

    const result = await safeFetchJson<{ status: string; id: number }>('https://public.example/api', { maxBytes: 1024 });
    expect(result).toEqual({ status: 'ok', id: 42 });
    fetchMock.mockRestore();
  });
});
