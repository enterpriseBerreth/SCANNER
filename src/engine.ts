import { config } from './config.js';
import { latestSolanaPairs } from './dexscreener.js';
import { notify } from './notifier.js';
import { PaperBroker } from './paper.js';
import { assess } from './scoring.js';
import type { Candidate, Position } from './types.js';

export class ScannerEngine {
  candidates: Candidate[] = []; positions: Position[] = []; lastScanAt?: string; lastError?: string;
  paper = new PaperBroker();
  private alerted = new Set<string>(); private timer?: NodeJS.Timeout;

  async scan(): Promise<Candidate[]> {
    try {
      const pairs = await latestSolanaPairs();
      this.candidates = pairs.map(pair => assess(pair, { minLiquidity: config.MIN_LIQUIDITY_USD, maxFdvLiquidity: config.MAX_FDV_LIQUIDITY_RATIO }))
        .filter(candidate => candidate.score >= config.MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, 25);
      this.lastScanAt = new Date().toISOString(); this.lastError = undefined;
      for (const position of [...this.positions]) {
        const pair = pairs.find(item => item.baseToken.address === position.token); const price = Number(pair?.priceUsd);
        if (Number.isFinite(price) && price > 0) { const exit = this.evaluateExit(position, price); if (exit) this.closePaperPosition(position, price, exit); }
      }
      for (const candidate of this.candidates) if (!this.alerted.has(candidate.pairAddress)) { this.alerted.add(candidate.pairAddress); await notify(candidate); }
      return this.candidates;
    } catch (error) { this.lastError = error instanceof Error ? error.message : String(error); console.error('Scan failed:', this.lastError); return this.candidates; }
  }

  start() { void this.scan(); this.timer = setInterval(() => void this.scan(), config.SCAN_INTERVAL_SECONDS * 1000); }
  stop() { if (this.timer) clearInterval(this.timer); }
  // 9 position sizing/daily loss cap and 10 automated exits are enforced in paper mode below.
  openPaperPosition(candidate: Candidate, amountUsd = config.MAX_POSITION_USD): Position {
    if (this.positions.some(position => position.token === candidate.baseToken.address)) throw new Error('Position already exists');
    const position = this.paper.buy(candidate.baseToken.address, candidate.baseToken.symbol, Number(candidate.priceUsd), amountUsd, candidate.url);
    this.positions.push(position); return position;
  }
  closePaperPosition(position: Position, price: number, reason = 'manual sell') { const fill = this.paper.sell(position, price, reason); this.positions = this.positions.filter(item => item.token !== position.token); return fill; }
  evaluateExit(position: Position, price: number): string | undefined {
    position.highPrice = Math.max(position.highPrice, price); const pnl = (price / position.entryPrice - 1) * 100;
    if (pnl <= -config.STOP_LOSS_PERCENT) return 'hard stop-loss';
    if (pnl >= config.TAKE_PROFIT_PERCENT && price <= position.highPrice * (1 - config.TRAILING_STOP_PERCENT / 100)) return 'trailing take-profit';
    if (Date.now() - position.openedAt >= config.MAX_HOLD_MINUTES * 60_000) return 'time stop';
    return undefined;
  }
}
