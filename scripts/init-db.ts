import 'dotenv/config';
import { DatabaseManager } from '@/storage/database';
import { logger } from '@/server/logger';

async function main() {
  try {
    logger.info('Initializing database...');
    const dbManager = DatabaseManager.getInstance();
    const db = dbManager.getDb();

    // Verify tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    logger.info({ tables: tables.map(t => t.name) }, 'Database initialized successfully');
    dbManager.close();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Database initialization failed');
    process.exit(1);
  }
}

main();