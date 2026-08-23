import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL fehlt. Siehe .env.example.');
}

/**
 * Eine Verbindung pro Prozess. Next.js laedt Module im Entwicklungsmodus neu,
 * deshalb haengt der Client am globalen Objekt, statt bei jedem Reload neue
 * Verbindungen zu oeffnen.
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const sql = globalForDb.sql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema, sql };
