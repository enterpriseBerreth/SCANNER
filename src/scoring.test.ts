import { describe, expect, it } from 'vitest';
import { assess } from './scoring.js';
import type { Pair } from './types.js';
import { PaperBroker } from './paper.js';

const pair: Pair = { chainId: 'solana', pairAddress: 'x', url: 'https://example.com', dexId: 'raydium', baseToken: { address: 'token', name: 'Token', symbol: 'TOK' }, quoteToken: { address: 'sol', symbol: 'SOL' }, priceUsd: '1', liquidity: { usd: 100_000 }, fdv: 1_000_000, pairCreatedAt: Date.now() - 30 * 60_000, volume: { m5: 20_000 }, priceChange: { m5: 12 }, txns: { m5: { buys: 30, sells: 15 } }, info: { websites: [{}], socials: [{}] } };
describe('assess', () => { it('rewards balanced, liquid momentum', () => expect(assess(pair, { minLiquidity: 30_000, maxFdvLiquidity: 25 }).score).toBeGreaterThanOrEqual(90)); it('flags thin liquidity', () => expect(assess({ ...pair, liquidity: { usd: 100 } }, { minLiquidity: 30_000, maxFdvLiquidity: 25 }).riskFlags).toContain('thin liquidity')); });
describe('paper broker', () => { it('uses quoted buy/sell output and books network fees', () => { const broker = new PaperBroker(); broker.solUsd = 100; const position = broker.buyQuoted('token', 'TOK', { inAmount: '100000000', outAmount: '100000000', priceImpactPct: '0.01' }, 8, 'https://example.com'); const fill = broker.sellQuoted(position, { inAmount: '100000000', outAmount: '120000000', priceImpactPct: '0.01' }); expect(broker.fills).toHaveLength(2); expect(fill.totalFeesUsd).toBeGreaterThan(0); expect(fill.realizedPnlUsd).toBeGreaterThan(0); }); });
