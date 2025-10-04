import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Winston logger configuration
 * - Production: JSON format for structured logging
 * - Development: Human-readable format with colors
 * - Logs to STDOUT only
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      ),
  transports: [
    new winston.transports.Console()
  ],
});

export default logger;
