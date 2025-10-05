import 'dotenv/config';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import crypto from 'crypto';
import serialize from 'serialize-javascript';
import { saveValidation, getValidation } from './database';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import logger from './logger';
import helmet from 'helmet';

export const app = express();
const rootPath = process.env.ROOT_PATH || "."

// Trust proxy: use number of hops for AWS Lambda/API Gateway
// API Gateway adds X-Forwarded-For header (1 hop)
app.set('trust proxy', 1);

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, rootPath, 'swagger.yaml'));

// Security middleware - Helmet with strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "'unsafe-eval'", // Required for Ajv's dynamic code generation (uses new Function())
        // Note: Nonces will be added per-request for injected scripts
      ],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles in app.js
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"], // Prevent iframe embedding (clickjacking protection)
    },
  },
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  // HSTS for production (only when served over HTTPS)
  strictTransportSecurity: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// Middleware
app.use(bodyParser.json({ limit: '300kb' }));
app.use(express.static(path.join(__dirname, rootPath, 'public')));

// Rate limiter for /api/save endpoint
const saveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many validation save requests',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipFailedRequests: true, // Don't count failed requests (status >= 400)
});

// Zod validation schema for /api/save
const saveValidationSchema = z.object({
  schema: z.any().refine((val) => val !== undefined && val !== null, {
    message: 'Schema is required and cannot be null',
  }),
  json: z.any().refine((val) => val !== undefined && val !== null, {
    message: 'JSON is required and cannot be null',
  }),
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// POST /api/save - Save a validation and return ID
app.post('/api/save', saveRateLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const validation = saveValidationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.message
      });
    }

    const { schema, json } = validation.data;

    // Stringify for storage (schema and json are already parsed objects from bodyParser.json())
    const schemaString = JSON.stringify(schema);
    const jsonString = JSON.stringify(json);

    const id = await saveValidation(schemaString, jsonString);

    logger.info('Validation saved', { id, schemaSize: schemaString.length, jsonSize: jsonString.length });

    res.json({ id });
  } catch (error) {
    logger.error('Error saving validation', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - Serve HTML with embedded validation data
app.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Skip if it's a static file request
  if (id.includes('.')) {
    return res.status(404).send('Not found');
  }

  try {
    const validation = await getValidation(id);

    if (!validation) {
      return res.status(404).send('Validation not found or expired');
    }

    // Generate cryptographic nonce for CSP
    const nonce = crypto.randomBytes(16).toString('base64');

    // Read the base HTML file and inject data
    const fs = require('fs');
    const htmlPath = path.join(__dirname, rootPath, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Inject the validation data as a script tag before </body>
    // Parse stored strings back to JSON objects
    // Use serialize-javascript library for safe XSS-free serialization
    // This handles all edge cases: </script>, line terminators, HTML entities, etc.
    const safeData = serialize({
      schema: JSON.parse(validation.schema),
      json: JSON.parse(validation.json)
    }, { isJSON: true }); // isJSON: true ensures JSON-compatible output with XSS protection

    const dataScript = `
    <script nonce="${nonce}">
      window.INITIAL_DATA = ${safeData};
    </script>
  `;
    html = html.replace('</body>', `${dataScript}</body>`);

    // Set CSP header with nonce for this specific script
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error loading validation', { error });
    res.status(500).send('Internal server error');
  }
});

// GET / - Serve the main HTML page (empty)
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, rootPath, 'public/index.html'));
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// Start server (only when running directly, not when imported for Lambda)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}
