import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Get data directory
const DATA_DIR = process.env.DATA_DIR || './data';

// Ensure correct path separator
const dbPath = path.join(DATA_DIR, 'ragbase.db');
// console.log(`SQLite database path: ${dbPath}`);

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema }); 