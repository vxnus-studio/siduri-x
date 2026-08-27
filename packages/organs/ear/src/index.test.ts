import { DefaultEarOrgan, detectAudioSignature } from './index';

describe('DefaultEarOrgan Adversarial Remediation Suite', () => {
  it('ingests plain text message and populates metadata', async () => {
    const ear = new DefaultEarOrgan();
    const perception = await ear.listen('user_chat', 'Hello Siduri');

    expect(perception.source).toBe('user_chat');
    expect(perception.text).toBe('Hello Siduri');
    expect(perception.modality).toBe('text');
    expect(perception.metadata?.byteSize).toBeGreaterThan(0);
    expect(perception.id).toMatch(/^ear-/);
  });

  it('rejects oversized text input according to configured limit', async () => {
    const ear = new DefaultEarOrgan({ maxTextLength: 100 });
    const longText = 'A'.repeat(150);

    await expect(ear.listen('user_chat', longText)).rejects.toThrow(
      /Ear text input exceeds maximum allowed length/
    );
  });

  it('rejects oversized audio input according to configured byte limit', async () => {
    const ear = new DefaultEarOrgan({ maxAudioBytes: 1024 }); // 1KB limit
    const bigAudio = new Uint8Array(2048);

    await expect(ear.listen('microphone', bigAudio)).rejects.toThrow(
      /Ear audio input exceeds maximum allowed size/
    );
  });

  it('rejects unsupported audio MIME type', async () => {
    const ear = new DefaultEarOrgan();
    const audio = new Uint8Array([1, 2, 3]);

    await expect(
      ear.listen('microphone', audio, { mimeType: 'video/mp4' })
    ).rejects.toThrow(/MIME type "video\/mp4" is not supported/);
  });

  it('detects valid WAV signature (RIFF/WAVE) and rejects mismatched declared MIME type', async () => {
    const ear = new DefaultEarOrgan();
    // Construct valid RIFF WAV header
    const wavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // length
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
    ]);

    expect(detectAudioSignature(wavBytes)).toBe('audio/wav');

    // Mismatched declared MIME: declares MP3 but signature is WAV
    await expect(
      ear.listen('microphone', wavBytes, { mimeType: 'audio/mp3' })
    ).rejects.toThrow(/Audio signature mismatch: declared MIME "audio\/mp3" does not match detected format "audio\/wav"/);

    // Matching declared MIME: declares WAV and signature is WAV
    const legitPerception = await ear.listen('microphone', wavBytes, { mimeType: 'audio/wav', durationSeconds: 2 });
    expect(legitPerception.modality).toBe('audio');
    expect(legitPerception.metadata?.verifiedMimeType).toBe('audio/wav');
    expect(legitPerception.metadata?.untrustedDurationSeconds).toBe(2);
  });

  it('ingests structured object with metadata and limits check', async () => {
    const ear = new DefaultEarOrgan();
    const perception = await ear.listen('webhook', { text: 'Notification alert', sender: 'system' });

    expect(perception.text).toBe('Notification alert');
    expect(perception.modality).toBe('object');
    expect(perception.metadata?.sender).toBe('system');
  });

  it('transcribes audio if transcriber is provided', async () => {
    const ear = new DefaultEarOrgan({
      transcriber: async () => 'transcribed voice text',
    });
    const perception = await ear.listen('microphone', new Uint8Array([1, 2, 3]));

    expect(perception.text).toBe('transcribed voice text');
    expect(perception.modality).toBe('audio');
    expect(perception.audioBuffer).toBeDefined();
    expect(perception.rawConfidence).toBeGreaterThan(0.9);
  });
});
