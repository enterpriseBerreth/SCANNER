import { config } from './config.js';
import type { Candidate } from './types.js';

export async function notify(candidate: Candidate): Promise<void> {
  const message = `SCANNER alert (paper only)\n${candidate.baseToken.symbol} · score ${candidate.score}/100\n${candidate.reasons.join(' | ')}\nRisks: ${candidate.riskFlags.join(', ') || 'none identified by rules'}\n${candidate.url}`;
  console.log(message);
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return;
  const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true })
  });
  if (!response.ok) console.error(`Telegram notification failed: ${response.status}`);
}
