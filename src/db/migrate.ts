import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import { initData } from './schema';

/**
 * Execute database migration and initialization
 * This function should be called at application startup, not during build process
 */
export async function runMigrations() {
  // Get data directory
  const DATA_DIR = process.env.DATA_DIR || './data';

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`Created data directory: ${DATA_DIR}`);
    } catch (error) {
      console.error(`Failed to create data directory: ${DATA_DIR}`, error);
    }
  }

  // Ensure correct path separator
  const dbPath = path.join(DATA_DIR, 'ragbase.db');
  console.log(`SQLite database path for migration: ${dbPath}`);

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  try {
    // Execute database migration
    console.log('Running database migrations...');
    migrate(db, { migrationsFolder: './src/db/drizzle' });
    console.log('Database migrations completed successfully');

    // Initialize default data
    await initData(db);
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database migration or initialization failed:', error);
    throw error;
  } finally {
    // Close database connection
    sqlite.close();
  }
} 

(async () => {
    try {
      await runMigrations();
    } catch (error) {
      console.error('Init db data failed:', error);
    }
  })(); 