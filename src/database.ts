import initSqlJs, { Database } from 'sql.js';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/validations.db');

let db: Database;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create table
  db.run(`
    CREATE TABLE IF NOT EXISTS validations (
      id TEXT PRIMARY KEY,
      schema TEXT NOT NULL,
      json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on created_at for faster cleanup
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON validations(created_at)
  `);
}

// Save database to file
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

// Initialize on module load
initDB().catch(console.error);

export interface ValidationRecord {
  id: string;
  schema: string;
  json: string;
  created_at: string;
}

/**
 * Clean up records older than 7 days
 * Called on each request to piggyback cleanup
 */
export function cleanupOldRecords(): void {
  if (!db) return;
  db.run(`
    DELETE FROM validations
    WHERE created_at < datetime('now', '-7 days')
  `);
  saveDB();
}

/**
 * Generate a random short ID
 */
function generateId(): string {
  return randomBytes(6).toString('base64url');
}

/**
 * Save a validation record
 */
export function saveValidation(schema: string, json: string): string {
  if (!db) throw new Error('Database not initialized');

  cleanupOldRecords();

  const id = generateId();
  db.run(`
    INSERT INTO validations (id, schema, json)
    VALUES (?, ?, ?)
  `, [id, schema, json]);

  saveDB();
  return id;
}

/**
 * Get a validation record by ID
 */
export function getValidation(id: string): ValidationRecord | null {
  if (!db) throw new Error('Database not initialized');

  cleanupOldRecords();

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
