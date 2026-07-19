import { config } from './config.js';
import type { PaperFill, Position } from './types.js';

const bps = (value: number, rate: number) => value * rate / 10_000;
const networkFeeUsd = (priorityLamports: number, solUsd: number) => (config.PAPER_BASE_FEE_LAMPORTS + priorityLamports + config.PAPER_JITO_TIP_LAMPORTS) / 1_000_000_000 * solUsd;
const id = () => `paper_${crypto.randomUUID()}`;

/** A transparent paper ledger, using current observed price plus configurable execution frictions. */
export class PaperBroker {
  cashUsd = config.PAPER_STARTING_CASH_USD;
  solUsd = config.PAPER_SOL_USD;
  priorityFeeLamports = config.PAPER_PRIORITY_FEE_LAMPORTS;
  fills: PaperFill[] = [];
  buy(token: string, symbol: string, observedPrice: number, requestedUsd: number, pairUrl: string): Position {
    if (!Number.isFinite(observedPrice) || observedPrice <= 0) throw new Error('No valid observed price');
    if (requestedUsd <= 0 || requestedUsd > config.MAX_POSITION_USD) throw new Error(`Order must be between $0 and $${config.MAX_POSITION_USD}`);
    const fillPrice = observedPrice * (1 + config.PAPER_SLIPPAGE_BPS / 10_000);
    const dexFeeUsd = bps(requestedUsd, config.PAPER_DEX_FEE_BPS), chainFeeUsd = networkFeeUsd(this.priorityFeeLamports, this.solUsd), cost = requestedUsd + dexFeeUsd + chainFeeUsd;
    if (cost > this.cashUsd) throw new Error('Insufficient paper cash');
    this.cashUsd -= cost;
    const position: Position = { token, symbol, entryPrice: fillPrice, highPrice: fillPrice, amountUsd: requestedUsd, tokenAmount: requestedUsd / fillPrice, openedAt: Date.now(), pairUrl, entryFeesUsd: dexFeeUsd + chainFeeUsd };
    this.fills.unshift({ id: id(), side: 'BUY', token, symbol, price: fillPrice, tokenAmount: position.tokenAmount, grossUsd: requestedUsd, dexFeeUsd, networkFeeUsd: chainFeeUsd, slippageBps: config.PAPER_SLIPPAGE_BPS, totalFeesUsd: dexFeeUsd + chainFeeUsd, at: new Date().toISOString() });
    return position;
  }
  sell(position: Position, observedPrice: number, reason = 'manual sell'): PaperFill {
    const fillPrice = observedPrice * (1 - config.PAPER_SLIPPAGE_BPS / 10_000), grossUsd = position.tokenAmount * fillPrice;
    const dexFeeUsd = bps(grossUsd, config.PAPER_DEX_FEE_BPS), chainFeeUsd = networkFeeUsd(this.priorityFeeLamports, this.solUsd), proceeds = grossUsd - dexFeeUsd - chainFeeUsd;
    this.cashUsd += proceeds;
    const realizedPnlUsd = proceeds - position.amountUsd - position.entryFeesUsd;
    const fill = { id: id(), side: 'SELL' as const, token: position.token, symbol: position.symbol, price: fillPrice, tokenAmount: position.tokenAmount, grossUsd, dexFeeUsd, networkFeeUsd: chainFeeUsd, slippageBps: config.PAPER_SLIPPAGE_BPS, totalFeesUsd: dexFeeUsd + chainFeeUsd, realizedPnlUsd, reason, at: new Date().toISOString() };
    this.fills.unshift(fill); return fill;
  }
}
