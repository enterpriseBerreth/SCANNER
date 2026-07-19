import express from 'express';
import { config } from './config.js';
import { ScannerEngine } from './engine.js';

const app = express(); const engine = new ScannerEngine();
app.use(express.json());
app.get('/', (_req, res) => res.json({ name: 'SCANNER', mode: config.EXECUTION_MODE, disclaimer: 'Momentum alerts only; not financial advice. Execution is disabled.', endpoints: ['/health', '/api/status', '/api/candidates', '/api/scan'] }));
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/api/status', (_req, res) => res.json({ mode: config.EXECUTION_MODE, lastScanAt: engine.lastScanAt, lastError: engine.lastError, candidates: engine.candidates.length, positions: engine.positions.length }));
app.get('/api/candidates', (_req, res) => res.json(engine.candidates));
app.post('/api/scan', async (_req, res) => res.json(await engine.scan()));
app.post('/api/paper-positions/:pairAddress', (req, res) => {
  const candidate = engine.candidates.find(item => item.pairAddress === req.params.pairAddress);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found; scan first.' });
  try { return res.status(201).json(engine.openPaperPosition(candidate)); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid position' }); }
});
engine.start();
app.listen(config.PORT, () => console.log(`SCANNER listening on ${config.PORT} in ${config.EXECUTION_MODE} mode`));
