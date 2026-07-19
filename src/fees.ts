import { config } from './config.js';

/** Conservative 75th-percentile of recent on-chain priority fees; falls back to the configured amount. */
export async function recentPriorityFeeLamports(): Promise<number> {
  try {
    const response = await fetch(config.SOLANA_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentPrioritizationFees', params: [[]] }), signal: AbortSignal.timeout(8_000) });
    const body = await response.json() as { result?: Array<{ prioritizationFee: number }> }; const values = (body.result || []).map(item => item.prioritizationFee).filter(Number.isFinite).sort((a, b) => a - b);
    return values.length ? values[Math.floor((values.length - 1) * .75)] : config.PAPER_PRIORITY_FEE_LAMPORTS;
  } catch { return config.PAPER_PRIORITY_FEE_LAMPORTS; }
}
