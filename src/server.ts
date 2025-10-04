import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { saveValidation, getValidation } from './database';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

export const app = express();
const rootPath = process.env.ROOT_PATH || "."

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, rootPath, 'swagger.yaml'));

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
app.post('/api/save', saveRateLimiter, (req: Request, res: Response) => {
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

    const id = saveValidation(schemaString, jsonString);
    res.json({ id });
  } catch (error) {
    console.error('Error saving validation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - Serve HTML with embedded validation data
app.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // Skip if it's a static file request
  if (id.includes('.')) {
    return res.status(404).send('Not found');
  }

  try {
    const validation = getValidation(id);

    if (!validation) {
      return res.status(404).send('Validation not found or expired');
    }

    // Read the base HTML file and inject data
    const fs = require('fs');
    const htmlPath = path.join(__dirname, rootPath, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Inject the validation data as a script tag before </body>
    // Parse stored strings back to JSON objects
    const dataScript = `
    <script>
      window.INITIAL_DATA = ${JSON.stringify({
        schema: JSON.parse(validation.schema),
        json: JSON.parse(validation.json)
      })};
    </script>
  `;
    html = html.replace('</body>', `${dataScript}</body>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error loading validation:', error);
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
