import { 
  OpenRouterVisionAdapter, 
  CroppedVisionAdapter, 
  MultiPassVisionAdapter, 
  expandPartyList,
  VisionReading
} from './index';
import { VisionOrgan } from '@siduri/core';
import EventEmitter from 'events';

global.fetch = jest.fn();

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));
import { spawn } from 'child_process';

describe('OpenRouterVisionAdapter', () => {
  let adapter: OpenRouterVisionAdapter;

  beforeEach(() => {
    adapter = new OpenRouterVisionAdapter({ apiKey: 'test-key' });
    (global.fetch as jest.Mock).mockClear();
  });

  test('analyze sends correct payload', async () => {
    const payloadJson = JSON.stringify({
      choices: [
        { message: { content: 'This is a test image' } }
      ]
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => payloadJson,
      json: async () => JSON.parse(payloadJson),
    });

    const result = await adapter.analyze('data:image/png;base64,ABC', 'What is this?');
    expect(result).toBe('This is a test image');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe('google/gemini-pro-vision');
    expect(body.messages[0].content[0].text).toBe('What is this?');
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/png;base64,ABC');
    expect(call[1].headers.Authorization).toBe('Bearer test-key');
  });

  test('throws error on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });

    await expect(adapter.analyze('abc', 'test')).rejects.toThrow('Vision API error (401): Unauthorized');
  });
});

function createMockProcess(stdoutData: Buffer, exitCode: number = 0) {
  const proc: any = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  proc.kill = jest.fn();

  process.nextTick(() => {
    if (stdoutData && stdoutData.length > 0) {
      proc.stdout.emit('data', stdoutData);
    }
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('CroppedVisionAdapter', () => {
  let mockProvider: jest.Mocked<VisionOrgan>;

  beforeEach(() => {
    mockProvider = { analyze: jest.fn() };
    (spawn as jest.Mock).mockClear();
  });

  test('crops image and modifies source_crop', async () => {
    (spawn as jest.Mock).mockImplementation(() => createMockProcess(Buffer.from('CROPPED', 'utf8'), 0));

    mockProvider.analyze.mockResolvedValueOnce(JSON.stringify([
      { entity: 'test', value: '123', confidence: 0.9 }
    ]));

    const adapter = new CroppedVisionAdapter(mockProvider, { name: 'test-region', x: 0, y: 0, width: 100, height: 100 });
    const resultStr = await adapter.analyze('data:image/png;base64,ORIGINAL', 'prompt');
    const result = JSON.parse(resultStr);

    expect(spawn).toHaveBeenCalled();
    expect(mockProvider.analyze).toHaveBeenCalledWith('data:image/png;base64,Q1JPUFBFRA==', 'prompt');
    expect(result[0].source_crop).toBe('test-region');
  });

  test('sets top party as active if missing and requested', async () => {
    (spawn as jest.Mock).mockImplementation(() => createMockProcess(Buffer.from('CROPPED', 'utf8'), 0));

    mockProvider.analyze.mockResolvedValueOnce(JSON.stringify([
      { entity: 'party_member', value: 'Venti', confidence: 0.9, ocr_text: 'Venti' }
    ]));

    const adapter = new CroppedVisionAdapter(mockProvider, { name: 'hud', x: 0, y: 0, width: 100, height: 100 }, true);
    const resultStr = await adapter.analyze('data:image/png;base64,IMG', 'prompt');
    const result = JSON.parse(resultStr);

    expect(result.length).toBe(2);
    expect(result[0].entity).toBe('active_character');
    expect(result[0].value).toBe('Venti');
    expect(result[0].source_crop).toBe('hud');
  });
});

describe('expandPartyList', () => {
  test('expands numbered list', () => {
    const input: VisionReading[] = [{
      entity: 'party_list',
      value: 'Venti(1), Zhongli(2)',
      confidence: 1.0,
      source_crop: 'hud'
    }];
    const output = expandPartyList(input);
    expect(output.length).toBe(4);
    expect(output[0].entity).toBe('party_list');
    expect(output[1].entity).toBe('active_character');
    expect(output[1].value).toBe('Venti');
    expect(output[2].entity).toBe('party_member');
    expect(output[2].value).toBe('Venti');
    expect(output[3].entity).toBe('party_member');
    expect(output[3].value).toBe('Zhongli');
  });
});

describe('MultiPassVisionAdapter', () => {
  let provider1: jest.Mocked<VisionOrgan>;
  let provider2: jest.Mocked<VisionOrgan>;

  beforeEach(() => {
    provider1 = { analyze: jest.fn() };
    provider2 = { analyze: jest.fn() };
  });

  test('combines readings from passes', async () => {
    provider1.analyze.mockResolvedValueOnce(JSON.stringify([
      { entity: 'scene', value: 'combat', confidence: 0.9 }
    ]));
    provider2.analyze.mockResolvedValueOnce(JSON.stringify([
      { entity: 'party_member', value: 'Zhongli', confidence: 0.8 }
    ]));

    const adapter = new MultiPassVisionAdapter([
      { provider: provider1, prompt: 'pass1' },
      { provider: provider2, prompt: 'pass2' }
    ]);

    const resultStr = await adapter.analyze('img', 'prompt');
    const result = JSON.parse(resultStr);

    expect(result.length).toBe(2);
    expect(result[0].entity).toBe('scene');
    expect(result[1].entity).toBe('party_member');
    expect(provider1.analyze).toHaveBeenCalledWith('img', 'pass1');
    expect(provider2.analyze).toHaveBeenCalledWith('img', 'pass2');
  });
});
