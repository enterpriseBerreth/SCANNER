import { Pool } from 'pg';
import { config } from './config.js';

export type StoredState = { cashUsd: number; fills: unknown[]; positions: unknown[]; dailyStartingCapital: Array<[string, number]>; lastDailyReportDate?: string };

/** Single-row durable state store. DATABASE_URL is absent locally, so development stays zero-config. */
export class StateStore {
  private pool?: Pool;
  constructor() { if (config.DATABASE_URL) this.pool = new Pool({ connectionString: config.DATABASE_URL }); }
  async init() { if (!this.pool) return; await this.pool.query('CREATE TABLE IF NOT EXISTS scanner_state (id BOOLEAN PRIMARY KEY DEFAULT TRUE, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())'); }
  async load(): Promise<StoredState | undefined> { if (!this.pool) return undefined; const result = await this.pool.query<{ data: StoredState }>('SELECT data FROM scanner_state WHERE id = TRUE'); return result.rows[0]?.data; }
  async save(data: StoredState) { if (!this.pool) return; await this.pool.query('INSERT INTO scanner_state (id, data, updated_at) VALUES (TRUE, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [JSON.stringify(data)]); }
  async close() { await this.pool?.end(); }
}
