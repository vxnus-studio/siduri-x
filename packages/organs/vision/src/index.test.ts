import { 
  OpenRouterVisionAdapter, 
  CroppedVisionAdapter, 
  MultiPassVisionAdapter, 
  expandPartyList,
  VisionReading
} from './index';
import { VisionOrgan } from '@siduri-y/core';

global.fetch = jest.fn();

jest.mock('child_process', () => ({
  spawnSync: jest.fn()
}));
import { spawnSync } from 'child_process';

describe('OpenRouterVisionAdapter', () => {
  let adapter: OpenRouterVisionAdapter;

  beforeEach(() => {
    adapter = new OpenRouterVisionAdapter({ apiKey: 'test-key' });
    (global.fetch as jest.Mock).mockClear();
  });

  test('analyze sends correct payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: 'This is a test image' } }
        ]
      })
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

describe('CroppedVisionAdapter', () => {
  let mockProvider: jest.Mocked<VisionOrgan>;

  beforeEach(() => {
    mockProvider = { analyze: jest.fn() };
    (spawnSync as jest.Mock).mockClear();
  });

  test('crops image and modifies source_crop', async () => {
    (spawnSync as jest.Mock).mockReturnValue({
      status: 0,
      stdout: Buffer.from('CROPPED', 'utf8')
    });

    mockProvider.analyze.mockResolvedValueOnce(JSON.stringify([
      { entity: 'test', value: '123', confidence: 0.9 }
    ]));

    const adapter = new CroppedVisionAdapter(mockProvider, { name: 'test-region', x: 0, y: 0, width: 100, height: 100 });
    const resultStr = await adapter.analyze('data:image/png;base64,ORIGINAL', 'prompt');
    const result = JSON.parse(resultStr);

    expect(spawnSync).toHaveBeenCalled();
    expect(mockProvider.analyze).toHaveBeenCalledWith('data:image/png;base64,Q1JPUFBFRA==', 'prompt');
    expect(result[0].source_crop).toBe('test-region');
  });

  test('sets top party as active if missing and requested', async () => {
    (spawnSync as jest.Mock).mockReturnValue({
      status: 0,
      stdout: Buffer.from('CROPPED', 'utf8')
    });

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
