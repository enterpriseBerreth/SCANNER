import { config } from './config.js';
import type { Candidate, PaperFill, Position } from './types.js';

async function send(message: string): Promise<void> {
  console.log(message);
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return;
  const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true })
  });
  if (!response.ok) console.error(`Telegram notification failed: ${response.status}`);
}

export async function notify(candidate: Candidate): Promise<void> {
  const message = `SCANNER alert (paper only)\n${candidate.baseToken.symbol} · score ${candidate.score}/100\n${candidate.reasons.join(' | ')}\nRisks: ${candidate.riskFlags.join(', ') || 'none identified by rules'}\n${candidate.url}`;
  await send(message);
}

export async function notifyTrade(fill: PaperFill, position?: Position): Promise<void> {
  const pnl = fill.realizedPnlUsd ?? -(fill.totalFeesUsd);
  const denominator = position ? position.amountUsd + position.entryFeesUsd : fill.grossUsd;
  const pnlPct = denominator ? pnl / denominator * 100 : 0;
  const message = [
    `SCANNER PAPER ${fill.side} · ${fill.symbol}`,
    `Fill: $${fill.price.toFixed(8)} · ${fill.tokenAmount.toFixed(4)} tokens`,
    `Gross: $${fill.grossUsd.toFixed(2)} · Fees: $${fill.totalFeesUsd.toFixed(4)} · Slippage: ${fill.slippageBps} bps`,
    `PNL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)${fill.reason ? ` · ${fill.reason}` : ''}`
  ].join('\n');
  await send(message);
}

export async function notifyDailyReport(report: { date: string; trades: number; wins: number; losses: number; startingCapital: number; endingCapital: number; pnl: number; fees: number; tips: string[] }): Promise<void> {
  const pnlPct = report.startingCapital ? report.pnl / report.startingCapital * 100 : 0;
  const message = [
    `SCANNER DAILY PAPER REPORT · ${report.date}`,
    `Trades: ${report.trades} · Profitable: ${report.wins} · Lost: ${report.losses}`,
    `Capital: $${report.startingCapital.toFixed(2)} → $${report.endingCapital.toFixed(2)}`,
    `PNL: ${report.pnl >= 0 ? '+' : ''}$${report.pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
    `Simulated fees: $${report.fees.toFixed(2)}`,
    'Optimization review:', ...report.tips.map(tip => `• ${tip}`)
  ].join('\n');
  await send(message);
}
