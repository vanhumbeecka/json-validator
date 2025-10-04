import serverless from 'serverless-http';
import { app } from './server';

// Wrap Express app for AWS Lambda
export const handler = serverless(app);
