import type { Candidate, Pair } from './types.js';

const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Deterministic scoring: high score is an alert, never a promise or trade advice. */
export function assess(pair: Pair, limits: { minLiquidity: number; maxFdvLiquidity: number }): Candidate {
  const liquidity = num(pair.liquidity?.usd), volume5m = num(pair.volume?.m5), change5m = num(pair.priceChange?.m5);
  const buys = num(pair.txns?.m5?.buys), sells = num(pair.txns?.m5?.sells), total = buys + sells;
  const ageMinutes = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 60000 : Infinity;
  const fdv = num(pair.fdv || pair.marketCap), ratio = liquidity ? fdv / liquidity : Infinity;
  let score = 0; const reasons: string[] = []; const riskFlags: string[] = [];
  const change1h = num(pair.priceChange?.h1), change24h = num(pair.priceChange?.h24), volume1h = num(pair.volume?.h1);
  // 1 liquidity quality; 2 volume/liquidity confirmation; 3 organic buy flow; 4 fresh-launch priority.
  if (liquidity >= limits.minLiquidity) { score += 22; reasons.push(`$${Math.round(liquidity).toLocaleString()} liquidity`); } else riskFlags.push('thin liquidity');
  if (liquidity && volume5m / liquidity >= 0.08 && volume5m / liquidity <= 2.5) { score += 18; reasons.push('healthy volume/liquidity turnover'); } else riskFlags.push('unconfirmed turnover');
  if (total >= 12 && buys / total >= 0.55 && buys / total <= 0.88) { score += 18; reasons.push('buy flow exceeds sells without being extreme'); } else riskFlags.push('weak or one-sided trade flow');
  if (ageMinutes >= 0 && ageMinutes <= 10) { score += 18; reasons.push(`${Math.max(0, Math.round(ageMinutes))}m priority fresh-launch window`); }
  else if (ageMinutes > 10 && ageMinutes <= 240) { score += 10; reasons.push(`${Math.round(ageMinutes)}m early momentum candidate`); }
  else if (ageMinutes > 240 && ageMinutes <= 1440) { score += 7; reasons.push('established same-day momentum candidate'); }
  else if (ageMinutes > 1440 && change1h > 1 && change1h <= 25 && change24h > 0 && volume1h >= liquidity * .04) { score += 7; reasons.push('older token with sustained positive growth'); }
  else riskFlags.push('age profile lacks sustained growth confirmation');
  // 5 immediate and sustained momentum, 6 valuation sanity, 7 discovery metadata, 8 no paid-boost dependence.
  if (change5m >= 3 && change5m <= 35) { score += 15; reasons.push(`${change5m.toFixed(1)}% 5m momentum`); } else riskFlags.push('momentum is absent or overheated');
  if (ageMinutes > 240 && change1h > 1 && change1h <= 30 && change24h > 0) { score += 5; reasons.push(`${change1h.toFixed(1)}% 1h continuation`); }
  if (ratio <= limits.maxFdvLiquidity) { score += 10; reasons.push('FDV/liquidity is within limit'); } else riskFlags.push('high FDV-to-liquidity ratio');
  if ((pair.info?.websites?.length || 0) + (pair.info?.socials?.length || 0) >= 2) { score += 3; reasons.push('public project links present'); }
  if (num(pair.boosts?.active) > 0) riskFlags.push('paid boost present: do not treat as organic demand'); else score += 2;
  return { ...pair, score, reasons, riskFlags };
}
