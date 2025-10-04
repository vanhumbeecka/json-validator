import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { DatabaseProvider, ValidationRecord, generateId } from './types';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/validations.db');

let db: Database;

/**
 * Initialize SQLite database
 */
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create table (no TTL - local dev only)
  db.run(`
    CREATE TABLE IF NOT EXISTS validations (
      id TEXT PRIMARY KEY,
      schema TEXT NOT NULL,
      json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Save database to file
 */
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

/**
 * SQLite database provider
 */
export class SQLiteProvider implements DatabaseProvider {
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = initDB();
  }

  async saveValidation(schema: string, json: string): Promise<string> {
    await this.initPromise;
    if (!db) throw new Error('Database not initialized');

    const id = generateId();
    db.run(`
      INSERT INTO validations (id, schema, json)
      VALUES (?, ?, ?)
    `, [id, schema, json]);

    saveDB();
    return id;
  }

  async getValidation(id: string): Promise<ValidationRecord | null> {
    await this.initPromise;
    if (!db) throw new Error('Database not initialized');

    const result = db.exec(`
      SELECT id, schema, json, created_at
      FROM validations
      WHERE id = ?
    `, [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      schema: row[1] as string,
      json: row[2] as string,
      created_at: row[3] as string
    };
  }
}
