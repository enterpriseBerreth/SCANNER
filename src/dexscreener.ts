import type { Pair } from './types.js';

const BASE = 'https://api.dexscreener.com';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`DEX Screener returned ${response.status}`);
  return response.json() as Promise<T>;
}

/** Uses the documented latest token profiles endpoint, then fetches pairs in batches of 30. */
export async function latestSolanaPairs(): Promise<Pair[]> {
  const profiles = await getJson<Array<{ chainId?: string; tokenAddress?: string }>>('/token-profiles/latest/v1');
  const addresses = [...new Set(profiles.filter(p => p.chainId === 'solana' && p.tokenAddress).map(p => p.tokenAddress!))].slice(0, 60);
  const batches = Array.from({ length: Math.ceil(addresses.length / 30) }, (_, i) => addresses.slice(i * 30, i * 30 + 30));
  const results = await Promise.all(batches.map(batch => getJson<Pair[]>(`/tokens/v1/solana/${batch.join(',')}`)));
  return results.flat().filter(pair => pair.chainId === 'solana' && pair.quoteToken?.symbol === 'SOL');
}
