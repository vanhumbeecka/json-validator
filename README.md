# JSON Schema Validator

A web-based JSON Schema Validator with a Node.js/Express backend that supports both local deployment and AWS Lambda. Validate JSON data against JSON Schema definitions, save validations, and share them via unique URLs.

**Goal:** This project serves as a debug tool for verifying JSON schema mismatches. By storing validation results via the API, developers can easily share and troubleshoot schema validation issues with their team.

This app was vibe-coded using [Claude Code](https://claude.com/claude-code).

## Demo

Try it out at: [https://json-validator.codemine.be](https://json-validator.codemine.be)

## Features

- Real-time JSON validation against JSON Schema
- Save and share validations via unique URLs
- 1-day TTL for saved validations (production)
- API documentation with Swagger UI (available at `/api-docs`)

## Programmatic Usage

This tool can be used programmatically to store debug information from your application. Use the `POST /api/save` endpoint to save JSON schema validation failures directly from your code, then share the generated URL with your team for troubleshooting.

**Example:**

```javascript
const response = await fetch('<host>/api/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    schema: { type: 'object', properties: { name: { type: 'string' } } },
    json: { name: 123 }
  })
});

const { id } = await response.json();
console.log(`View validation: <host>/${id}`);
```

See `/api-docs` for full API documentation.

## Local Setup

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Deployment

### Database Configuration

The application supports two database providers:
- **SQLite** (default): Used for local development, no cleanup/TTL
- **DynamoDB**: Used for production AWS Lambda deployment with 1-day TTL

#### Environment Variables

- `DB_PROVIDER` - Database provider: `sqlite` (default) or `dynamodb`
- `DYNAMODB_TABLE_NAME` - DynamoDB table name (required when using DynamoDB)
- `AWS_REGION` - AWS region for DynamoDB (optional, defaults to SDK default)

### AWS Lambda

The demo at [https://json-validator.codemine.be](https://json-validator.codemine.be) is deployed using AWS Lambda with DynamoDB. This repository includes both build and deploy scripts to streamline the deployment process.

#### Prerequisites

1. Create a DynamoDB table:
   - Table name: Choose a name
   - Partition key: `PK` (String)
   - **Enable TTL**: Set TTL attribute name to `ttl`

2. Configure Lambda environment variables:
   ```
   DB_PROVIDER=dynamodb
   DYNAMODB_TABLE_NAME=<table-name>
   ```

#### Deploy

1. Build and package the application:
   ```bash
   npm run package
   ```

2. Deploy to AWS Lambda:
   ```bash
   npm run deploy
   ```

   Note: Ensure AWS credentials are configured in `~/.aws/credentials` and update the function name in `package.json` if needed.

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build for production
- `npm run package` - Create deployment package (deployment.zip)
- `npm run deploy` - Build, package, and deploy to AWS Lambda

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
