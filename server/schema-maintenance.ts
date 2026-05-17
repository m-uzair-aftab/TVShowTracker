import { pool } from "./db";
import { log } from "./vite";

export async function ensureShareSettingsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_share_settings (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      enabled boolean NOT NULL DEFAULT false,
      include_all_years boolean NOT NULL DEFAULT true,
      shared_years json NOT NULL DEFAULT '[]'::json,
      share_taste_profiles boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE user_share_settings
      ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS include_all_years boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS shared_years json NOT NULL DEFAULT '[]'::json,
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS share_taste_profiles boolean NOT NULL DEFAULT false
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_share_settings_user_id_unique
      ON user_share_settings(user_id)
  `);

  log("share settings schema ready");
}
