import express from 'express';
import { config } from './config.js';
import { ScannerEngine } from './engine.js';

const app = express(); const engine = new ScannerEngine();
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'GET' || !config.CONTROL_API_KEY) return next();
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return token === config.CONTROL_API_KEY ? next() : res.status(401).json({ error: 'Bearer control key required.' });
});
app.get('/', (_req, res) => res.json({ name: 'SCANNER', mode: config.EXECUTION_MODE, disclaimer: 'Momentum alerts only; not financial advice. Execution is disabled.', endpoints: ['/health', '/api/status', '/api/candidates', '/api/scan'] }));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, mode: config.EXECUTION_MODE, persistence: Boolean(config.DATABASE_URL) }));
app.get('/api/status', (_req, res) => res.json({ mode: config.EXECUTION_MODE, lastScanAt: engine.lastScanAt, lastError: engine.lastError, candidates: engine.candidates.length, positions: engine.positions.length, paperCashUsd: engine.paper.cashUsd }));
app.get('/api/candidates', (_req, res) => res.json(engine.candidates));
app.get('/api/paper-ledger', (_req, res) => res.json({ cashUsd: engine.paper.cashUsd, positions: engine.positions, fills: engine.paper.fills }));
app.post('/api/scan', async (_req, res) => res.json(await engine.scan()));
app.post('/api/paper-positions/:pairAddress', async (req, res) => {
  const candidate = engine.candidates.find(item => item.pairAddress === req.params.pairAddress);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found; scan first.' });
  try { return res.status(201).json(await engine.openPaperPosition(candidate, Number(req.body?.amountUsd ?? config.MAX_POSITION_USD))); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid position' }); }
});
app.post('/api/paper-positions/:pairAddress/sell', async (req, res) => {
  const position = engine.positions.find(item => item.token === req.params.pairAddress || item.token === req.body?.token);
  const candidate = engine.candidates.find(item => item.baseToken.address === position?.token); const price = Number(candidate?.priceUsd);
  if (!position || !Number.isFinite(price)) return res.status(404).json({ error: 'Open position or current price not found.' });
  return res.json(await engine.closePaperPosition(position, 'manual sell'));
});
void engine.start();
// Explicitly bind all interfaces: cloud platforms proxy traffic into the container.
app.listen(config.PORT, '0.0.0.0', () => console.log(`SCANNER listening on ${config.PORT} in ${config.EXECUTION_MODE} mode`));
