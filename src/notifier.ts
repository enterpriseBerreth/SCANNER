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

export async function notifyTrade(fill: PaperFill, position: Position, capitalAfterSell: number): Promise<void> {
  if (fill.side !== 'SELL' || fill.price === undefined) return;
  const pnl = fill.realizedPnlUsd ?? 0;
  const denominator = position.amountUsd + position.entryFeesUsd;
  const pnlPct = denominator ? pnl / denominator * 100 : 0;
  const summary = pnl >= 0 ? `Succeeded: ${fill.reason}. Preserve the same liquidity and route-impact discipline.` : `Failed: ${fill.reason}. Improve by tightening entry momentum, reducing allowed price impact, or exiting sooner.`;
  const message = [
    'SCANNER PAPER TRADE CLOSED',
    `Token: ${fill.symbol}`,
    `Price bought: $${position.entryPrice.toFixed(8)}`,
    `Price sold: $${fill.price.toFixed(8)}`,
    `PNL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
    `PNL %: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
    `Capital after sell: $${capitalAfterSell.toFixed(2)}`,
    summary
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
