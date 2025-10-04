import { randomBytes } from 'crypto';

/**
 * Validation record structure
 */
export interface ValidationRecord {
  id: string;
  schema: string;
  json: string;
  created_at: string;
}

/**
 * Database provider interface
 */
export interface DatabaseProvider {
  saveValidation(schema: string, json: string): Promise<string>;
  getValidation(id: string): Promise<ValidationRecord | null>;
}

/**
 * Generate a random ID with high entropy
 * Uses 12 bytes (16 characters in base64url) for better obfuscation
 */
export function generateId(): string {
  return randomBytes(12).toString('base64url');
}
