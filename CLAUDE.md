# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JSON Schema Validator web application with a Node.js/Express backend that can be deployed both locally and to AWS Lambda. It allows users to validate JSON against JSON Schema definitions, save validations, and share them via unique URLs.

## Architecture

### Dual Deployment Model
The application supports two deployment targets:
- **Local/Traditional**: Express server runs standalone (`src/server.ts`)
- **AWS Lambda**: Same Express app wrapped with `serverless-http` (`src/lambda.ts`)

Both targets share the same Express app instance exported from `server.ts`.

### Data Layer
Abstracted database layer with two providers (switchable via `DB_PROVIDER` env var):

**SQLite Provider** (default, for local dev):
- Uses `sql.js` (pure JavaScript, no native compilation)
- Records stored in `validations` table (id, schema, json, created_at)
- **No TTL/cleanup**: Local dev only, unlimited storage
- Database persisted to disk after each write operation via `saveDB()`
- Database path configurable via `DB_PATH` environment variable
- Located in `src/database/sqlite.ts`

**DynamoDB Provider** (for AWS Lambda production):
- Records stored with partition key `PK` (validation ID)
- Attributes: `PK`, `schema`, `json`, `created_at`, `ttl`
- **1-day TTL**: Automatic expiration using DynamoDB's native TTL feature
- No manual cleanup needed
- Configuration via `DYNAMODB_TABLE_NAME` and `AWS_REGION` env vars
- Located in `src/database/dynamodb.ts`

**Database Interface** (`src/database/index.ts`):
- Exports `saveValidation()` and `getValidation()` functions
- Both functions are async (return Promises)
- Provider selection based on `DB_PROVIDER` env var

### Routing Strategy
Three routes with specific behaviors:
1. `GET /` - Serves empty UI (static HTML)
2. `GET /:id` - Dynamically injects saved validation data into HTML via `window.INITIAL_DATA` script tag before serving
3. `POST /api/save` - Saves schema + JSON, returns unique ID for sharing

The `/:id` route reads `public/index.html`, injects data as a `<script>` block, then serves modified HTML.

### Client-Side Architecture
- **Validation**: Client-side only, using Ajv library (loaded from CDN)
- **Real-time**: Debounced validation on textarea input (200ms)
- **Data Loading**: Frontend checks for `window.INITIAL_DATA` on page load to populate editors

## Development Commands

```bash
# Install dependencies
npm install

# Run local development server (http://localhost:3000)
npm run dev

# Build for production (compiles TypeScript, copies files, installs prod deps)
npm run build

# Create AWS Lambda deployment package
npm run package  # Creates deployment.zip

# Deploy to AWS Lambda (requires AWS CLI configured)
npm run deploy

# Clean build artifacts
npm run clean  # Removes dist/ and deployment.zip
```

## Build Process

The build pipeline prepares files for AWS Lambda deployment:
1. `clean` - Remove dist/ directory and deployment.zip
2. `compile` - TypeScript compilation (src/ → dist/)
3. `copy-files` - Copy public/ to dist/public/, swagger.yaml to dist/, create dist/data/
4. `copy-deps` - Copy package.json to dist/ and install production dependencies only
5. `package` - Create deployment.zip from dist/ contents
6. `deploy` - Upload deployment.zip to AWS Lambda function named `json-validator`

Lambda handler: `lambda.handler` (points to `dist/lambda.js`)

## Environment Configuration

The application uses environment variables for configuration. Use a `.env` file for local development (loaded via `dotenv`).

**Required for all environments:**
- `PORT` - Server port (default: 3000)
- `ROOT_PATH` - Path to root directory relative to dist/ (default: `.`, set to `..` for dev)
- `NODE_ENV` - `development` or `production` (affects logging format)

**Logging:**
- `LOG_LEVEL` - `error`, `warn`, `info`, or `debug` (default: `info`)

**Database selection:**
- `DB_PROVIDER` - `sqlite` (default) or `dynamodb`

**SQLite-specific (when `DB_PROVIDER=sqlite`):**
- `DB_PATH` - Path to database file (default: `data/validations.db`)

**DynamoDB-specific (when `DB_PROVIDER=dynamodb`):**
- `DYNAMODB_TABLE_NAME` - DynamoDB table name (required)
- `AWS_REGION` - AWS region (optional, uses SDK default)

See `.env.example` for a complete reference.

## Key Implementation Details

### API Security & Validation
- **Rate Limiting**: 100 requests per 15 minutes per IP for `/api/save` (via `express-rate-limit`)
- **Request Size Limit**: 300KB maximum body size (via `body-parser`)
- **Input Validation**: Zod schema validation for `/api/save` endpoint
- **Error Handling**: Structured error responses with proper HTTP status codes

### Logging
- **Winston** logger configured in `src/logger.ts`
- **Development**: Human-readable colorized output with timestamps
- **Production**: JSON-structured logging for log aggregation
- All logs output to STDOUT only
- Logs include validation saves with ID and payload sizes

### Static File Detection
The `/:id` route skips URLs containing `.` to avoid matching static files (e.g., `/style.css`)

### ID Generation
Uses `randomBytes(12).toString('base64url')` for URL-safe, high-entropy IDs (16 characters)

### Client-Side Validation
- Ajv configured with `allErrors: true` to report all validation errors, not just the first
- Ajv 2020-12 draft support loaded from CDN
- Real-time validation with 200ms debounce
