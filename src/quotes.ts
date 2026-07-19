import { config } from './config.js';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export type RouteQuote = { inAmount: string; outAmount: string; priceImpactPct?: string; routePlan?: unknown[] };

/** Read-only route quote: no transaction, wallet, or authorization is created. */
export async function routeQuote(inputMint: string, outputMint: string, amount: string): Promise<RouteQuote> {
  const url = config.JUPITER_API_KEY ? 'https://api.jup.ag/swap/v1/quote' : 'https://lite-api.jup.ag/swap/v1/quote';
  const response = await fetch(`${url}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${config.PAPER_SLIPPAGE_BPS}`, { headers: config.JUPITER_API_KEY ? { 'x-api-key': config.JUPITER_API_KEY } : {}, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`No executable route quote (${response.status})`);
  const quote = await response.json() as RouteQuote; if (!quote.inAmount || !quote.outAmount || BigInt(quote.outAmount) <= 0n) throw new Error('Invalid route quote'); return quote;
}
