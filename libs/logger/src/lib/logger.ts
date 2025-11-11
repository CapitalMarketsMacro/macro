import pino from 'pino';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Format timestamp like Java loggers: [yyyy-MM-dd HH:mm:ss.SSS]
const formatTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}]`;
};

// Format log level to uppercase like Java loggers
const formatLevel = (level: number): string => {
  const levels: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
  };
  return levels[level] || 'INFO';
};

// Custom formatter for SLF4J/Log4J style output
const formatLogMessage = (logObj: any): string => {
  const timestamp = formatTimestamp();
  const level = formatLevel(logObj.level);
  const context = logObj.context || 'ROOT';
  const message = logObj.msg || '';
  const extra = logObj.extra ? ` ${JSON.stringify(logObj.extra)}` : '';
  
  return `${timestamp} [${level}] [${context}] - ${message}${extra}`;
};

// Base pino logger instance
// Use custom formatting to mimic SLF4J/Log4J style
const getBaseLoggerOptions = (): pino.LoggerOptions => {
  const level = (typeof process !== 'undefined' && process.env?.['LOG_LEVEL']) || 'info';
  
  if (isBrowser) {
    // Browser-friendly configuration with custom formatting
    return {
      level,
      browser: {
        asObject: false,
        write: {
          info: (o: any) => {
            const formatted = formatLogMessage(o);
            console.info(formatted);
          },
          error: (o: any) => {
            const formatted = formatLogMessage(o);
            console.error(formatted);
          },
          warn: (o: any) => {
            const formatted = formatLogMessage(o);
            console.warn(formatted);
          },
          debug: (o: any) => {
            const formatted = formatLogMessage(o);
            console.debug(formatted);
          },
        },
      },
    };
  } else {
    // Node.js configuration with custom formatting
    return {
      level,
      formatters: {
        level: (label: string) => {
          return { level: label.toUpperCase() };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Use a custom stream to format output
    };
  }
};

const baseLoggerOptions = getBaseLoggerOptions();

// For Node.js, we need to create a custom stream to format the output
let baseLogger: pino.Logger;
if (isBrowser) {
  baseLogger = pino(baseLoggerOptions);
} else {
  // Create a custom stream that formats output like SLF4J/Log4J
  const stream = {
    write: (log: string) => {
      try {
        const logObj = JSON.parse(log);
        const formatted = formatLogMessage(logObj);
        // Map pino levels to console methods
        const level = logObj.level;
        if (level >= 50) {
          process.stderr.write(formatted + '\n');
        } else if (level >= 40) {
          process.stderr.write(formatted + '\n');
        } else {
          process.stdout.write(formatted + '\n');
        }
      } catch {
        // Fallback to raw output if parsing fails
        process.stdout.write(log);
      }
    },
  };
  baseLogger = pino(baseLoggerOptions, stream);
}

// Cache for logger instances
const loggerCache = new Map<string, Logger>();

export class Logger {
  private pinoLogger: pino.Logger;
  private context: string;

  private constructor(context: string) {
    this.context = context;
    // Create a child logger with the context
    this.pinoLogger = baseLogger.child({ context });
  }

  /**
   * Get a logger instance for the given context.
   * Returns a cached instance if one exists for the context.
   */
  static getLogger(context: string): Logger {
    if (!loggerCache.has(context)) {
      loggerCache.set(context, new Logger(context));
    }
    return loggerCache.get(context)!;
  }

  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pinoLogger.debug({ extra: args }, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pinoLogger.info({ extra: args }, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pinoLogger.warn({ extra: args }, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pinoLogger.error({ extra: args }, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  /**
   * Get the context for this logger instance
   */
  getContext(): string {
    return this.context;
  }
}
