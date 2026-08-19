import { ETeyvatAdapter } from './index';

global.fetch = jest.fn();

describe('ETeyvatAdapter', () => {
  let adapter: ETeyvatAdapter;

  beforeEach(() => {
    adapter = new ETeyvatAdapter();
    (global.fetch as jest.Mock).mockClear();
  });

  test('search queries knowledge correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        revision: 'rev_123',
        items: [
          {
            slug: 'ganyu',
            entity_id: 'ganyu-1',
            name: 'Ganyu',
            content: 'Plenilune Gaze',
            kind: 'characters'
          }
        ]
      })
    });

    const results = await adapter.search("Ganyu");
    
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('Plenilune Gaze');
    expect(results[0].provenance).toBe('https://eteyvat.krzgn.xyz/api/entities/characters/ganyu');
    
    expect(adapter.currentRevision).toBe('rev_123');
    
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/knowledge/search?q=Ganyu&limit=8');
  });

  test('search handles empty query gracefully', async () => {
    const results = await adapter.search("   ");
    expect(results.length).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
