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
- **Real-time**: Debounced validation on textarea input (500ms)
- **Data Loading**: Frontend checks for `window.INITIAL_DATA` on page load to populate editors

## Development Commands

```bash
# Install dependencies
npm install

# Run local development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Create AWS Lambda deployment package
npm run package  # Creates deployment.zip
```

## Build Process

The build pipeline prepares files for AWS Lambda deployment:
1. `clean` - Remove dist/ directory
2. `compile` - TypeScript compilation (src/ → dist/)
3. `copy-files` - Copy public/ to dist/public/ and create dist/data/ directory
4. `copy-deps` - Install production dependencies in dist/
5. `package` - Create deployment.zip from dist/ contents

Lambda handler: `lambda.handler` (points to `dist/lambda.js`)

## Key Implementation Details

### Database Configuration

**Environment Variables:**
- `DB_PROVIDER`: `sqlite` (default) or `dynamodb`
- `DB_PATH`: SQLite database path (default: `data/validations.db` relative to dist/)
- `DYNAMODB_TABLE_NAME`: DynamoDB table name (required when `DB_PROVIDER=dynamodb`)
- `AWS_REGION`: AWS region for DynamoDB (optional, uses SDK default if not set)

**Local Development:**
- Uses SQLite provider by default
- Database at `data/validations.db` (relative to dist/)
- No TTL or cleanup

**AWS Lambda Production:**
- Set `DB_PROVIDER=dynamodb`
- DynamoDB table with `PK` partition key and `ttl` attribute enabled
- 1-day automatic expiration

### Static File Detection
The `/:id` route skips URLs containing `.` to avoid matching static files (e.g., `/style.css`)

### ID Generation
Uses `randomBytes(12).toString('base64url')` for URL-safe, high-entropy IDs (16 characters)
