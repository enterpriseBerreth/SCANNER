# SCANNER

SCANNER is a Solana new-token momentum **scanner and paper-trading bot**. It finds newly profiled Solana pairs, filters for quality and momentum, and sends evidence-rich alerts. It does not custody keys, submit swaps, or promise profitability.

> Crypto assets are highly speculative. A score is a screening signal—not investment advice, a prediction, or a guarantee. Start with paper trading and independently validate every token and transaction.

## The 10 practices implemented

No bot can reliably “capture maximum profitability.” The designs that aim for durable risk-adjusted results generally concentrate on avoiding bad trades and controlling losses as much as finding momentum. SCANNER implements these ten controls:

| # | Practice | SCANNER implementation |
|---|---|---|
| 1 | Require real liquidity | Rejects pairs under `MIN_LIQUIDITY_USD`. |
| 2 | Confirm volume is tradable | Requires 5-minute volume/liquidity turnover in a reasonable range. |
| 3 | Check organic buy pressure | Requires enough trades and a 55–88% buy ratio; extremes are flagged. |
| 4 | Trade a defined new-pair window | Scores only pairs aged 3–240 minutes. |
| 5 | Avoid late/parabolic entries | Scores moderate 5-minute momentum and flags absent or overheated moves. |
| 6 | Check valuation versus available liquidity | Rejects excessive FDV/liquidity ratios. |
| 7 | Use multiple public signals | Awards small credit for both website/social metadata, rather than treating it as proof. |
| 8 | Do not mistake paid visibility for demand | Paid boosts are explicitly flagged and never improve the score. |
| 9 | Size small and cap downside | Paper positions use `MAX_POSITION_USD`; configuration includes a daily-loss limit for the future audited executor. |
| 10 | Define exits before entry | Hard stop-loss, trailing take-profit, and maximum-hold-time checks are built in. |

The scanner also deduplicates alerts and exposes its decisions (score, reasons, risk flags) so performance can be reviewed rather than blindly followed.

## Paper buys, sells, and real-world friction

`POST /api/paper-positions/:pairAddress` now buys using the candidate's current observed DEX Screener price. Optional body: `{ "amountUsd": 10 }`. The ledger at `GET /api/paper-ledger` records each simulated buy/sell, observed fill price, tokens, DEX fee, network/priority/tip cost, slippage, cash balance, and realized P&L. `POST /api/paper-positions/:pairAddress/sell` closes it at the latest observed price; scan cycles can also execute the predefined paper exits.

Default costs are deliberately visible in `.env.example`: 30 bps DEX fee, 100 bps per-side slippage, a 5,000-lamport base fee, and a 100,000-lamport priority-fee assumption. The base fee and priority-fee structure follows [Solana's official fee documentation](https://solana.com/docs/core/fees/fee-structure); actual route, compute, and congestion costs vary, so set the values to your intended route and conditions. These are simulated fills—no signed transactions are submitted.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000/api/candidates` after the first scan. `POST /api/scan` triggers an on-demand scan. `POST /api/paper-positions/:pairAddress` records a paper position for a currently qualified candidate.

## Configuration

Copy `.env.example`; the defaults are intentionally conservative and paper-only. Telegram alerts require both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

`EXECUTION_MODE` accepts only `paper`. This is intentional: a production trading executor needs additional independent safeguards—on-chain mint/freeze authority checks, holder concentration analysis, honeypot/simulation checks, route/price-impact validation, encrypted key handling, transaction simulation, persistent accounting, and a human authorization boundary. Do not put a private key in Railway variables for this starter.

## Railway deployment

This repository includes a `Dockerfile` and `railway.toml`. In the Railway service linked to this project:

1. Link the GitHub repository that contains this project.
2. Set the variables from `.env.example` (leave `EXECUTION_MODE=paper`).
3. Deploy; Railway uses `/health` as the health check.

No secret values are committed. Railway supplies `PORT`; SCANNER respects it.

## Data source

SCANNER uses DEX Screener’s documented latest token profiles and batched token-pairs endpoints. These endpoints are rate-limited, so the default interval is deliberately 30 seconds. Consult the [DEX Screener API reference](https://docs.dexscreener.com/api/reference) before changing polling behavior or using the data commercially.

## API

- `GET /health` — Railway health check
- `GET /api/status` — scan status and error state
- `GET /api/candidates` — latest qualifying signals and reasons
- `POST /api/scan` — run one scan
- `POST /api/paper-positions/:pairAddress` — record a bounded paper position
