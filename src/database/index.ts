import { DatabaseProvider, ValidationRecord } from './types';
import { SQLiteProvider } from './sqlite';
import { DynamoDBProvider } from './dynamodb';
import logger from '../logger';

/**
 * Get the database provider based on environment variable
 */
function getProvider(): DatabaseProvider {
  const provider = process.env.DB_PROVIDER || 'sqlite';

  switch (provider.toLowerCase()) {
    case 'dynamodb':
      logger.info('Using DynamoDB provider');
      return new DynamoDBProvider();
    case 'sqlite':
    default:
      logger.info('Using SQLite provider');
      return new SQLiteProvider();
  }
}

// Initialize the provider
const db = getProvider();

/**
 * Save a validation record
 */
export async function saveValidation(schema: string, json: string): Promise<string> {
  return db.saveValidation(schema, json);
}

/**
 * Get a validation record by ID
 */
export async function getValidation(id: string): Promise<ValidationRecord | null> {
  return db.getValidation(id);
}

export { ValidationRecord };
