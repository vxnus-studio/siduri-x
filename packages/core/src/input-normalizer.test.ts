import { normalizeUserInput } from './input-normalizer';

describe('InputNormalizer', () => {
  test('rejects empty or oversized messages', async () => {
    await expect(normalizeUserInput('', 'OWNER', [], 'comp-1')).rejects.toThrow(
      'message must be a non-empty string of at most 4000 characters'
    );

    await expect(normalizeUserInput('   ', 'OWNER', [], 'comp-1')).rejects.toThrow(
      'message must be a non-empty string of at most 4000 characters'
    );

    const oversized = 'a'.repeat(4001);
    await expect(normalizeUserInput(oversized, 'OWNER', [], 'comp-1')).rejects.toThrow(
      'message must be a non-empty string of at most 4000 characters'
    );
  });

  test('rejects oversized history or invalid message roles', async () => {
    const invalidHistory: any[] = Array(21).fill({ role: 'user', content: 'hi' });
    await expect(normalizeUserInput('hi', 'OWNER', invalidHistory, 'comp-1')).rejects.toThrow(
      'history must contain at most 20 user/assistant messages'
    );

    const malformedRole = [{ role: 'bad_role', content: 'test' }];
    await expect(normalizeUserInput('hi', 'OWNER', malformedRole as any, 'comp-1')).rejects.toThrow(
      'history must contain at most 20 user/assistant messages'
    );
  });

  test('normalizes role string into full RequestContext and strips null bytes from history', async () => {
    const historyWithNulls = [{ role: 'user' as const, content: 'hello\0world' }];
    const result = await normalizeUserInput('hello', 'OWNER', historyWithNulls, 'comp-1');

    expect(result.role).toBe('OWNER');
    expect(result.requestContext.companionId).toBe('comp-1');
    expect(result.requestContext.actor.authorizationRole).toBe('administrator');
    expect(result.requestContext.actor.authenticated).toBe(true);
    expect(result.boundedHistory[0].content).toBe('helloworld');
  });

  test('routes input through EarOrgan when present', async () => {
    const mockEar = {
      listen: jest.fn().mockResolvedValue({
        id: 'perc-1',
        source: 'text_chat',
        text: 'transcribed text',
        timestamp: new Date().toISOString(),
      }),
    };

    const result = await normalizeUserInput('raw text', 'VIEWER', [], 'comp-1', mockEar);

    expect(mockEar.listen).toHaveBeenCalledWith('text_chat', 'raw text', expect.anything());
    expect(result.perceivedText).toBe('transcribed text');
  });
});
