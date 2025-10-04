import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DatabaseProvider, ValidationRecord, generateId } from './types';

/**
 * DynamoDB database provider with 1-day TTL
 */
export class DynamoDBProvider implements DatabaseProvider {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const tableName = process.env.DYNAMODB_TABLE_NAME;

    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is required for DynamoDB provider');
    }

    this.tableName = tableName;

    const dynamoClient = new DynamoDBClient({
      region: region || undefined,
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async saveValidation(schema: string, json: string): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 86400; // 1 day from now in Unix timestamp

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: id,
        schema,
        json,
        created_at: now,
        ttl,
      },
    }));

    return id;
  }

  async getValidation(id: string): Promise<ValidationRecord | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: id,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return {
      id: result.Item.PK,
      schema: result.Item.schema,
      json: result.Item.json,
      created_at: result.Item.created_at,
    };
  }
}
