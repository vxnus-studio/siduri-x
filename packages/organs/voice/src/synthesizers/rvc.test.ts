import { RvcPostProcessor } from './rvc';
import { Synthesizer } from './synthesizer';

describe('RvcPostProcessor', () => {
  let mockBaseSynth: jest.Mocked<Synthesizer>;

  beforeEach(() => {
    mockBaseSynth = {
      synthesize: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('base-audio'))),
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns base audio directly if RVC is disabled', async () => {
    const rvc = new RvcPostProcessor(mockBaseSynth, { enabled: false }, 1000, 1000000);
    const result = await rvc.synthesize('hello');
    
    expect(mockBaseSynth.synthesize).toHaveBeenCalledWith('hello');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(Buffer.from(result).toString()).toBe('base-audio');
  });

  test('calls RVC conversion service if enabled', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-length', '9']]),
      arrayBuffer: async () => new ArrayBuffer(9)
    });

    const rvc = new RvcPostProcessor(mockBaseSynth, { enabled: true, serviceUrl: 'http://rvc:50055' }, 1000, 1000000);
    const result = await rvc.synthesize('hello');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('http://rvc:50055/convert');
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toBeInstanceOf(FormData);
    
    expect(result.byteLength).toBe(9);
  });

  test('falls back to base audio if RVC conversion fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error'
    });

    const spyWarn = jest.spyOn(console, 'warn').mockImplementation();

    const rvc = new RvcPostProcessor(mockBaseSynth, { enabled: true, serviceUrl: 'http://rvc:50055' }, 1000, 1000000);
    const result = await rvc.synthesize('hello');

    expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('RVC conversion failed'));
    expect(Buffer.from(result).toString()).toBe('base-audio');
  });

  test('falls back to base audio if network request throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation();

    const rvc = new RvcPostProcessor(mockBaseSynth, { enabled: true, serviceUrl: 'http://rvc:50055' }, 1000, 1000000);
    const result = await rvc.synthesize('hello');

    expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('RVC service error'));
    expect(Buffer.from(result).toString()).toBe('base-audio');
  });
});
