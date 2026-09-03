import { EdgeTtsSynthesizer } from './edge-tts';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'node:fs/promises';

jest.mock('node-edge-tts');
jest.mock('node:fs/promises');

describe('EdgeTtsSynthesizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('synthesizes text using node-edge-tts and returns a Uint8Array', async () => {
    const mockTtsPromise = jest.fn().mockResolvedValue(undefined);
    (EdgeTTS as jest.Mock).mockImplementation(() => ({
      ttsPromise: mockTtsPromise,
    }));

    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-audio-data'));
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    const synthesizer = new EdgeTtsSynthesizer('en-US-AriaNeural');
    const result = await synthesizer.synthesize('hello world');

    expect(mockTtsPromise).toHaveBeenCalledTimes(1);
    expect(mockTtsPromise.mock.calls[0][0]).toBe('hello world');
    // Check that it writes to tmp file
    expect(mockTtsPromise.mock.calls[0][1]).toMatch(/edge-tts-.*\.mp3$/);

    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(result).toString()).toBe('mock-audio-data');
  });

  test('cleans up temporary file even if synthesis fails', async () => {
    const mockTtsPromise = jest.fn().mockRejectedValue(new Error('TTS failure'));
    (EdgeTTS as jest.Mock).mockImplementation(() => ({
      ttsPromise: mockTtsPromise,
    }));

    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    const synthesizer = new EdgeTtsSynthesizer();
    
    await expect(synthesizer.synthesize('hello world')).rejects.toThrow('TTS failure');

    expect(fs.readFile).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });
});
