import 'dotenv/config';
import { z } from 'zod';

const env = z.object({
  PORT: z.coerce.number().default(3000), SCAN_INTERVAL_SECONDS: z.coerce.number().min(10).default(30),
  MIN_SCORE: z.coerce.number().min(1).max(100).default(79), MIN_LIQUIDITY_USD: z.coerce.number().min(1000).default(30000),
  MAX_FDV_LIQUIDITY_RATIO: z.coerce.number().min(1).default(25), MAX_POSITION_USD: z.coerce.number().positive().default(25),
  MAX_DAILY_LOSS_USD: z.coerce.number().positive().default(50), TAKE_PROFIT_PERCENT: z.coerce.number().positive().default(35),
  STOP_LOSS_PERCENT: z.coerce.number().positive().default(12), TRAILING_STOP_PERCENT: z.coerce.number().positive().default(10),
  MAX_HOLD_MINUTES: z.coerce.number().positive().default(60), EXECUTION_MODE: z.enum(['paper']).default('paper'),
  PAPER_STARTING_CASH_USD: z.coerce.number().positive().default(1000), PAPER_DEX_FEE_BPS: z.coerce.number().min(0).max(1000).default(30),
  PAPER_SLIPPAGE_BPS: z.coerce.number().min(0).max(5000).default(100), PAPER_SOL_USD: z.coerce.number().positive().default(150),
  PAPER_BASE_FEE_LAMPORTS: z.coerce.number().min(0).default(5000), PAPER_PRIORITY_FEE_LAMPORTS: z.coerce.number().min(0).default(100000), PAPER_JITO_TIP_LAMPORTS: z.coerce.number().min(0).default(0),
  DAILY_REPORT_TIME_ZONE: z.string().default('America/Denver'), DAILY_REPORT_HOUR: z.coerce.number().int().min(0).max(23).default(20),
  DATABASE_URL: z.string().optional(),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'), JUPITER_API_KEY: z.string().optional(),
  MAX_OPEN_POSITIONS: z.coerce.number().int().min(1).max(20).default(3), MAX_TOP_HOLDER_PERCENT: z.coerce.number().min(1).max(100).default(25),
  MAX_QUOTE_PRICE_IMPACT_PERCENT: z.coerce.number().min(.1).max(100).default(15), CONTROL_API_KEY: z.string().min(16).optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(), TELEGRAM_CHAT_ID: z.string().optional()
}).parse(process.env);
export const config = env;
