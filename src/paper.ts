import { config } from './config.js';
import type { PaperFill, Position } from './types.js';
import type { RouteQuote } from './quotes.js';

const networkFeeUsd = (priorityLamports: number, solUsd: number) => (config.PAPER_BASE_FEE_LAMPORTS + priorityLamports + config.PAPER_JITO_TIP_LAMPORTS) / 1_000_000_000 * solUsd;
const id = () => `paper_${crypto.randomUUID()}`;

/** Route-quote paper ledger. Swap/route cost is reflected in quote output; only chain fees are added separately. */
export class PaperBroker {
  cashUsd = config.PAPER_STARTING_CASH_USD;
  solUsd = config.PAPER_SOL_USD;
  priorityFeeLamports = config.PAPER_PRIORITY_FEE_LAMPORTS;
  fills: PaperFill[] = [];
  buyQuoted(token: string, symbol: string, quote: RouteQuote, decimals: number, pairUrl: string): Position {
    const requestedUsd = Number(quote.inAmount) / 1e9 * this.solUsd;
    if (requestedUsd <= 0 || requestedUsd > config.MAX_POSITION_USD) throw new Error(`Order must be between $0 and $${config.MAX_POSITION_USD}`);
    const tokenAmount = Number(quote.outAmount) / 10 ** decimals; if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) throw new Error('Invalid quote token output');
    const fillPrice = requestedUsd / tokenAmount, chainFeeUsd = networkFeeUsd(this.priorityFeeLamports, this.solUsd), cost = requestedUsd + chainFeeUsd;
    if (cost > this.cashUsd) throw new Error('Insufficient paper cash');
    this.cashUsd -= cost;
    const position: Position = { token, symbol, entryPrice: fillPrice, highPrice: fillPrice, amountUsd: requestedUsd, tokenAmount, tokenRawAmount: quote.outAmount, decimals, openedAt: Date.now(), pairUrl, entryFeesUsd: chainFeeUsd, entryPriceImpactPercent: Number(quote.priceImpactPct || 0) * 100 };
    this.fills.unshift({ id: id(), side: 'BUY', token, symbol, price: fillPrice, tokenAmount, grossUsd: requestedUsd, dexFeeUsd: 0, networkFeeUsd: chainFeeUsd, slippageBps: config.PAPER_SLIPPAGE_BPS, totalFeesUsd: chainFeeUsd, reason: 'route quote; DEX fees and price impact included in output', at: new Date().toISOString() });
    return position;
  }
  sellQuoted(position: Position, quote: RouteQuote, reason = 'exit rule'): PaperFill {
    const grossUsd = Number(quote.outAmount) / 1e9 * this.solUsd, fillPrice = grossUsd / position.tokenAmount;
    const chainFeeUsd = networkFeeUsd(this.priorityFeeLamports, this.solUsd), proceeds = grossUsd - chainFeeUsd;
    this.cashUsd += proceeds;
    const realizedPnlUsd = proceeds - position.amountUsd - position.entryFeesUsd;
    const fill = { id: id(), side: 'SELL' as const, token: position.token, symbol: position.symbol, price: fillPrice, tokenAmount: position.tokenAmount, grossUsd, dexFeeUsd: 0, networkFeeUsd: chainFeeUsd, slippageBps: config.PAPER_SLIPPAGE_BPS, totalFeesUsd: chainFeeUsd, realizedPnlUsd, reason, at: new Date().toISOString() };
    this.fills.unshift(fill); return fill;
  }
  recordBlockedExit(position: Position, reason: string) { const fill: PaperFill = { id: id(), side: 'FAILED_SELL', token: position.token, symbol: position.symbol, tokenAmount: position.tokenAmount, grossUsd: 0, dexFeeUsd: 0, networkFeeUsd: 0, slippageBps: config.PAPER_SLIPPAGE_BPS, totalFeesUsd: 0, reason, at: new Date().toISOString() }; this.fills.unshift(fill); return fill; }
}
