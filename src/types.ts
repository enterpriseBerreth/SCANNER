export type Pair = {
  chainId: string; pairAddress: string; url: string; dexId: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string; liquidity?: { usd?: number }; fdv?: number; marketCap?: number;
  pairCreatedAt?: number; volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
  txns?: { m5?: { buys?: number; sells?: number }; h1?: { buys?: number; sells?: number } };
  info?: { websites?: unknown[]; socials?: unknown[] }; boosts?: { active?: number };
};

export type Candidate = Pair & { score: number; reasons: string[]; riskFlags: string[] };
export type Position = { token: string; symbol: string; entryPrice: number; highPrice: number; amountUsd: number; openedAt: number; pairUrl: string };
