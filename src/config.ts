import 'dotenv/config';
import { z } from 'zod';

const env = z.object({
  PORT: z.coerce.number().default(3000), SCAN_INTERVAL_SECONDS: z.coerce.number().min(10).default(30),
  MIN_SCORE: z.coerce.number().min(1).max(100).default(72), MIN_LIQUIDITY_USD: z.coerce.number().min(1000).default(30000),
  MAX_FDV_LIQUIDITY_RATIO: z.coerce.number().min(1).default(25), MAX_POSITION_USD: z.coerce.number().positive().default(25),
  MAX_DAILY_LOSS_USD: z.coerce.number().positive().default(50), TAKE_PROFIT_PERCENT: z.coerce.number().positive().default(35),
  STOP_LOSS_PERCENT: z.coerce.number().positive().default(12), TRAILING_STOP_PERCENT: z.coerce.number().positive().default(10),
  MAX_HOLD_MINUTES: z.coerce.number().positive().default(60), EXECUTION_MODE: z.enum(['paper']).default('paper'),
  PAPER_STARTING_CASH_USD: z.coerce.number().positive().default(1000), PAPER_DEX_FEE_BPS: z.coerce.number().min(0).max(1000).default(30),
  PAPER_SLIPPAGE_BPS: z.coerce.number().min(0).max(5000).default(100), PAPER_SOL_USD: z.coerce.number().positive().default(150),
  PAPER_BASE_FEE_LAMPORTS: z.coerce.number().min(0).default(5000), PAPER_PRIORITY_FEE_LAMPORTS: z.coerce.number().min(0).default(100000), PAPER_JITO_TIP_LAMPORTS: z.coerce.number().min(0).default(0),
  TELEGRAM_BOT_TOKEN: z.string().optional(), TELEGRAM_CHAT_ID: z.string().optional()
}).parse(process.env);
export const config = env;
