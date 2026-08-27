import { DefaultEarOrgan } from './index';

describe('DefaultEarOrgan', () => {
  it('ingests plain text message', async () => {
    const ear = new DefaultEarOrgan();
    const perception = await ear.listen('user_chat', 'Hello Siduri');

    expect(perception.source).toBe('user_chat');
    expect(perception.text).toBe('Hello Siduri');
    expect(perception.id).toMatch(/^ear-/);
  });

  it('ingests structured object with metadata', async () => {
    const ear = new DefaultEarOrgan();
    const perception = await ear.listen('webhook', { text: 'Notification alert', sender: 'system' });

    expect(perception.text).toBe('Notification alert');
    expect(perception.metadata).toEqual({ text: 'Notification alert', sender: 'system' });
  });

  it('transcribes audio if transcriber is provided', async () => {
    const ear = new DefaultEarOrgan({
      transcriber: async () => 'transcribed voice text',
    });
    const perception = await ear.listen('microphone', new Uint8Array([1, 2, 3]));

    expect(perception.text).toBe('transcribed voice text');
    expect(perception.audioBuffer).toBeDefined();
  });
});
