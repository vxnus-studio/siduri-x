import express from 'express';
import cors from 'cors';
import { SiduriRuntime } from './runtime';
import { OpenRouterBrain } from '@siduri-y/brain';
import { PostgresMemoryOrgan } from '@siduri-y/memory';
import { VoicevoxAdapter } from '@siduri-y/voice';
import { ETeyvatAdapter } from '@siduri-y/knowledge';
import { OpenRouterVisionAdapter } from '@siduri-y/vision';
import { ActiveSelfCompiler } from '@siduri-y/behavior';
import { Live2DAdapter } from '@siduri-y/body';

const app = express();
app.use(cors());
app.use(express.json());

const runtimes = new Map<string, SiduriRuntime>();

app.post('/boot', async (req, res) => {
  try {
    const { id, config } = req.body;
    if (runtimes.has(id)) {
      return res.status(400).json({ error: "Already booted" });
    }

    const brain = new OpenRouterBrain({ apiKey: process.env.OPENROUTER_API_KEY || '', model: config.brain.model || 'gpt-4' });
    const memory = new PostgresMemoryOrgan({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/siduri' });
    const voice = new VoicevoxAdapter({ baseUrl: process.env.VOICEVOX_URL || 'http://localhost:50021', speakerId: config.voice?.speakerId || 1 });
    const knowledge = new ETeyvatAdapter({ baseUrl: 'https://eteyvat.krzgn.xyz' });
    const vision = new OpenRouterVisionAdapter({ apiKey: process.env.OPENROUTER_API_KEY || '', model: config.vision?.model || 'gpt-4-vision' });
    const behavior = new ActiveSelfCompiler();
    const body = new Live2DAdapter({ port: 8089 });

    const runtime = new SiduriRuntime(id, config, { brain, memory, voice, knowledge, vision, behavior, body });
    await runtime.initialize();

    runtimes.set(id, runtime);
    res.json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// STATUS / HEALTH ENDPOINTS
app.get('/health', (req, res) => res.json({ status: "ok" }));
app.get('/version', (req, res) => res.json({ name: "siduri-y-api", version: "0.2.0-y" }));
app.get('/ready', (req, res) => res.json({ status: "ready", dependencies: {} }));
app.get('/voice/health', (req, res) => res.json({ provider: "voicevox", healthy: true }));
app.get('/obs/health', (req, res) => res.json({ connected: true }));
app.get('/platforms/status', (req, res) => res.json({ platforms: {} }));
app.get('/me', (req, res) => res.json({ name: "Primary User", role: "MASTER_STREAM" }));
app.put('/me', (req, res) => res.json({ success: true }));

// CHAT
app.post('/chat', async (req, res) => {
  const { id, message, role } = req.body;
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });

  try {
    const response = await runtime.handleUserMessage(message, role || 'VIEWER');
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY GETTERS
app.get('/memory/proposals', async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const proposals = await runtime.memory.getPendingClaims();
    res.json({ proposals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory', async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const items = await runtime.memory.getClaims();
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/claims', async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const claims = await runtime.memory.getClaims();
    res.json({ claims });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/memory/behavioral', async (req, res) => {
  const id = req.query.id as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    const directives = await runtime.memory.getDirectives();
    res.json({ directives });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY MUTATIONS - PROPOSALS
app.post('/memory/proposals/update', async (req, res) => res.json({ success: true }));

app.post('/memory/proposals/approve', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.approveClaim(req.body.id);
    res.json({ approved: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/proposals/reject', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.rejectClaim(req.body.id);
    res.json({ rejected: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// MEMORY MUTATIONS - BEHAVIORAL
app.post('/memory/behavioral/approve', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.approveDirective(req.body.id);
    res.json({ approved: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/reject', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.rejectDirective(req.body.id);
    res.json({ rejected: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/revoke', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.revokeDirective(req.body.id);
    res.json({ revoked: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/behavioral/disable', async (req, res) => {
  const id = req.body.companionId as string || Array.from(runtimes.keys())[0];
  const runtime = runtimes.get(id);
  if (!runtime) return res.status(404).json({ error: "Companion not found" });
  try {
    await runtime.memory.disableDirective(req.body.id);
    res.json({ disabled: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/dev/memory/reset', async (req, res) => res.json({ reset: true }));

// MOCKS / DEV / EVIDENCE / PLATFORMS
app.get('/platforms/events', (req, res) => res.json({ events: [] }));
app.get('/platforms/actions', (req, res) => res.json({ actions: [] }));
app.get('/evidence', (req, res) => res.json({ results: [] }));
app.get('/observations', (req, res) => res.json({ observations: [] }));

app.post('/dev/mock-response', (req, res) => res.json({ accepted: true }));
app.post('/dev/observe-and-respond', (req, res) => res.json({ accepted: true }));
app.post('/dev/approve-response', (req, res) => res.json({ approved: true }));
app.post('/dev/mock-observation', (req, res) => res.json({ accepted: true }));

app.post('/platforms/actions/suggest', (req, res) => res.json({ suggested: true }));
app.post('/platforms/actions/approve', (req, res) => res.json({ approved: true }));
app.post('/platforms/actions/reject', (req, res) => res.json({ rejected: true }));
app.post('/platforms/actions/send', (req, res) => res.json({ sent: true }));


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Siduri-Y API running on port ${PORT}`);
});
