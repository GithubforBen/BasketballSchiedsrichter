import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './index';

migrate(db, { migrationsFolder: './drizzle' })
  .then(() => {
    console.log('Migrationen eingespielt.');
    return sql.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
