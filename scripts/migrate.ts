import 'dotenv/config';
import { DatabaseManager } from '@/storage/database';
import { logger } from '@/server/logger';

async function main() {
  try {
    logger.info('Running migrations...');
    const dbManager = DatabaseManager.getInstance();
    const db = dbManager.getDb();

    // Migration logic would go here for future schema changes
    // For now, just verify current schema

    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];

    logger.info({ tables: tables.map(t => t.name) }, 'Current schema verified');
    dbManager.close();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  }
}

main();