import { config } from './config.js';
import { latestSolanaPairs, solUsdPrice } from './dexscreener.js';
import { recentPriorityFeeLamports } from './fees.js';
import { notify, notifyDailyReport, notifyTrade } from './notifier.js';
import { PaperBroker } from './paper.js';
import { StateStore, type StoredState } from './store.js';
import { assess } from './scoring.js';
import { inspectToken } from './risk.js';
import type { Candidate, Position } from './types.js';

export class ScannerEngine {
  candidates: Candidate[] = []; positions: Position[] = []; lastScanAt?: string; lastError?: string;
  paper = new PaperBroker();
  private alerted = new Set<string>(); private timer?: NodeJS.Timeout; private dailyStartingCapital = new Map<string, number>(); private lastDailyReportDate?: string; private stateDirty = false; private store = new StateStore();

  async restore() { try { await this.store.init(); const state = await this.store.load(); if (!state) return; this.paper.cashUsd = state.cashUsd; this.paper.fills = state.fills as typeof this.paper.fills; this.positions = state.positions as Position[]; this.dailyStartingCapital = new Map(state.dailyStartingCapital); this.lastDailyReportDate = state.lastDailyReportDate; console.log(`Restored paper ledger: $${this.paper.cashUsd.toFixed(2)} cash, ${this.positions.length} open positions`); } catch (error) { console.error('State restore failed; continuing with memory-only ledger:', error); } }
  private markDirty() { this.stateDirty = true; }
  private async persist() { if (!this.stateDirty) return; const state: StoredState = { cashUsd: this.paper.cashUsd, fills: this.paper.fills, positions: this.positions, dailyStartingCapital: [...this.dailyStartingCapital], lastDailyReportDate: this.lastDailyReportDate }; await this.store.save(state); this.stateDirty = false; }

  private localTime(value = new Date()) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config.DAILY_REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(value); const get = (type: string) => parts.find(part => part.type === type)?.value!; return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }; }
  private equity(pairs: { baseToken: { address: string }; priceUsd?: string }[]) { return this.paper.cashUsd + this.positions.reduce((total, position) => total + position.tokenAmount * (Number(pairs.find(pair => pair.baseToken.address === position.token)?.priceUsd) || position.entryPrice), 0); }
  private async reportIfDue(pairs: { baseToken: { address: string }; priceUsd?: string }[]) {
    const local = this.localTime(); if (!this.dailyStartingCapital.has(local.date)) { this.dailyStartingCapital.set(local.date, this.equity(pairs)); this.markDirty(); }
    // If Railway was down at 20:00, recover and send the missed report on the next scan that day.
    if (local.hour < config.DAILY_REPORT_HOUR || this.lastDailyReportDate === local.date) return;
    const todaysFills = this.paper.fills.filter(fill => this.localTime(new Date(fill.at)).date === local.date);
    const sales = todaysFills.filter(fill => fill.side === 'SELL');
    const wins = sales.filter(fill => (fill.realizedPnlUsd ?? 0) > 0).length, losses = sales.filter(fill => (fill.realizedPnlUsd ?? 0) < 0).length;
    const fees = todaysFills.reduce((total, fill) => total + fill.totalFeesUsd, 0);
    const startingCapital = this.dailyStartingCapital.get(local.date)!, endingCapital = this.equity(pairs), pnl = endingCapital - startingCapital;
    const tips = [sales.length === 0 ? 'No closed trades today: preserve selectivity; do not force entries.' : wins / sales.length < .45 ? 'Win rate is below 45%: raise MIN_SCORE or tighten buy-flow and liquidity filters.' : 'Maintain the current selectivity; review each exit against the rule that triggered it.', fees > Math.max(1, Math.abs(pnl) * .25) ? 'Fees are a large share of P&L: reduce churn, re-check priority-fee assumptions, and avoid very small orders.' : 'Keep position size capped and preserve hard-stop and time-stop discipline.', this.positions.length ? 'Open-position value is included in ending capital; unrealized P&L is not counted as a winning trade until sold.' : 'Closed-trade statistics exclude unrealized P&L.' ];
    await notifyDailyReport({ date: local.date, trades: sales.length, wins, losses, startingCapital, endingCapital, pnl, fees, tips }); this.lastDailyReportDate = local.date; this.markDirty();
  }

  async scan(): Promise<Candidate[]> {
    try {
      const [pairs, solUsd, priorityFeeLamports] = await Promise.all([latestSolanaPairs(), solUsdPrice(), recentPriorityFeeLamports()]);
      if (solUsd && Number.isFinite(solUsd)) this.paper.solUsd = solUsd;
      this.paper.priorityFeeLamports = priorityFeeLamports;
      const scored = pairs.map(pair => assess(pair, { minLiquidity: config.MIN_LIQUIDITY_USD, maxFdvLiquidity: config.MAX_FDV_LIQUIDITY_RATIO })).filter(candidate => candidate.score >= config.MIN_SCORE);
      const screened = await Promise.all(scored.map(async candidate => { const security = await inspectToken(candidate.baseToken.address, this.paper.solUsd, config.MAX_POSITION_USD); return { ...candidate, security, riskFlags: [...candidate.riskFlags, ...security.flags] }; }));
      this.candidates = screened.filter(candidate => !candidate.security?.hardReject).sort((a, b) => b.score - a.score).slice(0, 25);
      this.lastScanAt = new Date().toISOString(); this.lastError = undefined;
      await this.reportIfDue(pairs);
      await this.persist();
      for (const position of [...this.positions]) {
        const pair = pairs.find(item => item.baseToken.address === position.token); const price = Number(pair?.priceUsd);
        if (Number.isFinite(price) && price > 0) { const exit = this.evaluateExit(position, price); if (exit) this.closePaperPosition(position, price, exit); }
      }
      for (const candidate of this.candidates) if (!this.alerted.has(candidate.pairAddress)) { this.alerted.add(candidate.pairAddress); await notify(candidate); }
      if (config.AUTO_PAPER_TRADE) {
        for (const candidate of this.candidates) {
          // One paper entry per token preserves the auditability of the strategy and prevents churn/re-entry loops.
          if (this.paper.fills.some(fill => fill.side === 'BUY' && fill.token === candidate.baseToken.address)) continue;
          if (this.positions.length >= config.MAX_OPEN_POSITIONS) break;
          try { await this.openPaperPosition(candidate); } catch (error) { console.warn(`Paper entry skipped for ${candidate.baseToken.symbol}:`, error instanceof Error ? error.message : error); }
        }
      }
      return this.candidates;
    } catch (error) { this.lastError = error instanceof Error ? error.message : String(error); console.error('Scan failed:', this.lastError); return this.candidates; }
  }

  async start() { await this.restore(); await this.scan(); this.timer = setInterval(() => void this.scan(), config.SCAN_INTERVAL_SECONDS * 1000); }
  stop() { if (this.timer) clearInterval(this.timer); }
  // 9 position sizing/daily loss cap and 10 automated exits are enforced in paper mode below.
  async openPaperPosition(candidate: Candidate, amountUsd = config.MAX_POSITION_USD): Promise<Position> {
    if (candidate.score < config.MIN_SCORE || candidate.security?.hardReject) throw new Error('Candidate failed score or hard security filters');
    if (this.positions.some(position => position.token === candidate.baseToken.address)) throw new Error('Position already exists');
    if (this.positions.length >= config.MAX_OPEN_POSITIONS) throw new Error(`Maximum ${config.MAX_OPEN_POSITIONS} concurrent positions reached`);
    const todaysLoss = this.paper.fills.filter(fill => fill.side === 'SELL' && this.localTime(new Date(fill.at)).date === this.localTime().date).reduce((sum, fill) => sum + Math.min(0, fill.realizedPnlUsd ?? 0), 0);
    if (todaysLoss <= -config.MAX_DAILY_LOSS_USD) throw new Error('Daily loss circuit breaker is active');
    const position = this.paper.buy(candidate.baseToken.address, candidate.baseToken.symbol, Number(candidate.priceUsd), amountUsd, candidate.url);
    this.positions.push(position); this.markDirty(); await this.persist(); await notifyTrade(this.paper.fills[0], position); return position;
  }
  async closePaperPosition(position: Position, price: number, reason = 'manual sell') { const fill = this.paper.sell(position, price, reason); this.positions = this.positions.filter(item => item.token !== position.token); this.markDirty(); await this.persist(); await notifyTrade(fill, position); return fill; }
  evaluateExit(position: Position, price: number): string | undefined {
    position.highPrice = Math.max(position.highPrice, price); const pnl = (price / position.entryPrice - 1) * 100;
    if (pnl <= -config.STOP_LOSS_PERCENT) return 'hard stop-loss';
    if (pnl >= config.TAKE_PROFIT_PERCENT && price <= position.highPrice * (1 - config.TRAILING_STOP_PERCENT / 100)) return 'trailing take-profit';
    if (Date.now() - position.openedAt >= config.MAX_HOLD_MINUTES * 60_000) return 'time stop';
    return undefined;
  }
}
