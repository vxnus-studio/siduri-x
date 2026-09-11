import { generateInstanceFiles } from './generator';
import path from 'node:path';

describe('Localweb and CLI Standalone 1:1 Runtime & Chat Parity', () => {
  // Dynamically import from built packages/core to preserve decoupled packaging
  let dispatchCompanionChat: any;

  beforeAll(async () => {
    const coreModule = await import(path.resolve(__dirname, '../../packages/core/dist/index.js'));
    dispatchCompanionChat = coreModule.dispatchCompanionChat;
  });

  const fakeRuntime: any = {
    id: 'test-companion',
    handleUserMessage: jest.fn().mockImplementation(async (message: string, role: string, history: any[]) => {
      return {
        status: 'APPROVED',
        response_id: 'resp-123',
        correlation_id: 'corr-456',
        response: {
          speech_id: 'speech-789',
          audio_url: '/voice/stream?id=speech-789',
          subtitle_ja: `日本語: ${message}`,
          subtitle_en: `English: ${message}`,
        },
        metadata: {
          language: 'ja',
          internal_monologue: 'Monologue test',
          memory_proposals: [
            {
              proposal_id: 'prop-1',
              subject: 'user',
              predicate: 'likes',
              value: 'tea',
              status: 'PENDING',
            },
          ],
          events: [
            {
              event_id: 'evt-avatar-1',
              kind: 'avatar',
              lifecycle: 'STARTED',
              approval: 'APPROVED',
              expression: 'happy',
              action: 'talk',
            },
          ],
        },
      };
    }),
  };

  test('dispatchCompanionChat returns canonical ChatResponse structure consumed by apps/web', async () => {
    const payload = {
      id: 'test-companion',
      message: 'Hello Siduri',
      role: 'VIEWER' as const,
      history: [{ role: 'user' as const, content: 'Hi' }],
    };

    const result = await dispatchCompanionChat(fakeRuntime, payload);

    // 1. Top-level status & IDs
    expect(result.status).toBe('APPROVED');
    expect(result.response_id).toBe('resp-123');
    expect(result.correlation_id).toBe('corr-456');

    // 2. Exact contract expected by apps/web chat-client: data.response.{subtitle_en, spoken_ja, speech_id, evidence_ids}
    expect(result.response).toBeDefined();
    expect(result.response.subtitle_en).toBe('English: Hello Siduri');
    expect(result.response.subtitle_ja).toBe('日本語: Hello Siduri');
    expect(result.response.spoken_ja).toBe('日本語: Hello Siduri');
    expect(result.response.speech_id).toBe('speech-789');
    expect(result.response.audio_url).toBe('/voice/stream?id=speech-789');
    expect(result.response.evidence_ids).toEqual([]);

    // 3. Metadata proposals & events
    expect(result.metadata?.memory_proposals).toHaveLength(1);
    expect(result.metadata?.memory_proposals?.[0].proposal_id).toBe('prop-1');
    expect(result.metadata?.events).toHaveLength(1);
    expect(result.metadata?.events?.[0].expression).toBe('happy');

    // 4. Convenience backward-compatibility fields (no runtimeResult envelope nesting)
    expect(result.reply).toBe('日本語: Hello Siduri');
    expect(result.text).toBe('日本語: Hello Siduri');
    expect(result.expression).toBe('happy');
    expect(result.runtimeResult).toBeUndefined();
  });

  test('Generated CLI standalone src/index.js routes /chat through dispatchCompanionChat', () => {
    const mockManifest: any = {
      name: '@siduri-x/brain',
      organType: 'brain',
      version: '1.0.0',
      displayName: 'Brain',
      entrypoint: './dist/index.js',
      factory: 'OpenRouterBrain',
      configKey: 'brain',
    };

    const files = generateInstanceFiles({
      name: 'test-companion',
      selectedManifests: [mockManifest],
    });

    const srcIndexJs = files['src/index.js'];

    // Ensures single source of truth import
    expect(srcIndexJs).toContain("import { SiduriRuntime, dispatchCompanionChat, validateCompanionConfig } from '@siduri-x/core';");
    expect(srcIndexJs).toContain('validateCompanionConfig(config, schema);');

    // Ensures /chat uses dispatchCompanionChat directly without ad-hoc runtimeResult envelope
    expect(srcIndexJs).toContain('const response = await dispatchCompanionChat(runtime,');
    expect(srcIndexJs).toContain('res.end(JSON.stringify(response));');
    expect(srcIndexJs).not.toContain('runtimeResult,');
  });
});
