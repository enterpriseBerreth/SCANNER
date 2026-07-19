import { config } from './config.js';
import { routeQuote, SOL_MINT } from './quotes.js';
import type { SecurityResult } from './types.js';

const SPL_TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const rpc = async <T>(method: string, params: unknown[]): Promise<T> => {
  const response = await fetch(config.SOLANA_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(8_000) });
  const body = await response.json() as { result?: T; error?: { message?: string } }; if (!response.ok || body.error) throw new Error(body.error?.message || `RPC ${response.status}`); return body.result as T;
};
const little = (bytes: Uint8Array, offset: number, length: number) => { let value = 0n; for (let i = length - 1; i >= 0; i--) value = value * 256n + BigInt(bytes[offset + i]); return value; };

export async function inspectToken(mint: string, solUsd: number, orderUsd: number): Promise<SecurityResult> {
  const flags: string[] = [];
  try {
    const [account, supply, holders] = await Promise.all([
      rpc<{ value: { owner: string; data: [string, string] } | null }>('getAccountInfo', [mint, { encoding: 'base64' }]),
      rpc<{ value: { amount: string; decimals: number } }>('getTokenSupply', [mint]),
      rpc<{ value: Array<{ amount: string }> }>('getTokenLargestAccounts', [mint])
    ]);
    if (!account.value || !supply.value.amount || BigInt(supply.value.amount) === 0n) return { hardReject: true, flags: ['missing or zero token supply'] };
    const bytes = Uint8Array.from(Buffer.from(account.value.data[0], 'base64'));
    const mintAuthorityPresent = little(bytes, 0, 4) !== 0n, freezeAuthorityPresent = bytes.length >= 50 && little(bytes, 46, 4) !== 0n;
    if (mintAuthorityPresent) flags.push('mint authority still enabled'); if (freezeAuthorityPresent) flags.push('freeze authority still enabled');
    if (account.value.owner !== SPL_TOKEN) flags.push('non-standard/Token-2022 mint: extension and transfer-fee review required');
    const top = holders.value[0] ? Number(holders.value[0].amount) / Number(supply.value.amount) * 100 : 100;
    if (!Number.isFinite(top) || top > config.MAX_TOP_HOLDER_PERCENT) flags.push(`top holder concentration ${top.toFixed(1)}%`);
    let quotePriceImpactPercent: number | undefined;
    try {
      const amount = Math.max(1, Math.floor(orderUsd / solUsd * 1e9));
      try {
        const quote = await routeQuote(SOL_MINT, mint, String(amount)); quotePriceImpactPercent = Number(quote.priceImpactPct || 0) * 100;
        if (!Number.isFinite(quotePriceImpactPercent) || quotePriceImpactPercent > config.MAX_QUOTE_PRICE_IMPACT_PERCENT) flags.push(`quote price impact ${quotePriceImpactPercent.toFixed(1)}%`);
        // A reverse route check catches assets that can be quoted in but not economically routed back out.
        if (!quote.outAmount || BigInt(quote.outAmount) <= 0n) flags.push('invalid buy quote output'); else {
          try { await routeQuote(mint, SOL_MINT, quote.outAmount); } catch { flags.push('no executable sell quote'); }
        }
      } catch { flags.push('no executable buy quote'); }
    } catch { flags.push('quote validation unavailable'); }
    return { hardReject: flags.length > 0, flags, topHolderPercent: top, mintAuthorityPresent, freezeAuthorityPresent, tokenProgram: account.value.owner, quotePriceImpactPercent, decimals: supply.value.decimals };
  } catch { return { hardReject: true, flags: ['on-chain security validation unavailable'] }; }
}
