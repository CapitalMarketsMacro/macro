import pino from 'pino';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Log levels matching Java SLF4J/Log4J levels
 */
export enum LogLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}

/**
 * Convert log level string to numeric level
 */
const levelStringToNumber = (level: string): number => {
  const upperLevel = level.toUpperCase();
  const levelMap: Record<string, number> = {
    TRACE: LogLevel.TRACE,
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
    FATAL: LogLevel.FATAL,
  };
  return levelMap[upperLevel] || LogLevel.INFO;
};

/**
 * Convert numeric level to string
 */
const levelNumberToString = (level: number): string => {
  const levelMap: Record<number, string> = {
    [LogLevel.TRACE]: 'TRACE',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
  };
  return levelMap[level] || 'INFO';
};

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
// Pino uses: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
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

// Pretty print JSON with indentation
const prettyPrintJson = (obj: any, indent: number = 2): string => {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
};

// Custom formatter for SLF4J/Log4J style output with pretty JSON
const formatLogMessage = (logObj: any): string => {
  const timestamp = formatTimestamp();
  const level = formatLevel(logObj.level);
  const context = logObj.context || 'ROOT';
  const message = logObj.msg || '';
  
  // Extract all non-standard pino fields for pretty printing
  const { level: _, time, pid, hostname, context: ctx, msg, ...rest } = logObj;
  const hasData = Object.keys(rest).length > 0;
  
  if (hasData) {
    // Pretty print the data object
    const prettyData = prettyPrintJson(rest);
    return `${timestamp} [${level}] [${context}] - ${message}\n${prettyData}`;
  }
  
  return `${timestamp} [${level}] [${context}] - ${message}`;
};

// Global log level - can be changed at runtime
// Default to TRACE to allow child loggers to set their own levels
let globalLogLevel: number = levelStringToNumber(
  (typeof process !== 'undefined' && process.env?.['LOG_LEVEL']) || 'trace'
);

// Base pino logger instance
// Use custom formatting to mimic SLF4J/Log4J style
const getBaseLoggerOptions = (level?: number): pino.LoggerOptions => {
  const logLevel = level || globalLogLevel;
  const levelString = levelNumberToString(logLevel).toLowerCase();
  
  if (isBrowser) {
    // Browser-friendly configuration with custom formatting
    // Note: Browser mode doesn't filter by level automatically, so we handle it in the write functions
    return {
      level: levelString,
      browser: {
        asObject: false,
        write: {
          info: (o: any) => {
            const formatted = formatLogMessage(o);
            // Split message and data for better console display
            const lines = formatted.split('\n');
            if (lines.length > 1) {
              console.info(lines[0]);
              // The second line is already pretty printed JSON, just log it
              console.info(lines.slice(1).join('\n'));
            } else {
              console.info(formatted);
            }
          },
          error: (o: any) => {
            const formatted = formatLogMessage(o);
            const lines = formatted.split('\n');
            if (lines.length > 1) {
              console.error(lines[0]);
              console.error(lines.slice(1).join('\n'));
            } else {
              console.error(formatted);
            }
          },
          warn: (o: any) => {
            const formatted = formatLogMessage(o);
            const lines = formatted.split('\n');
            if (lines.length > 1) {
              console.warn(lines[0]);
              console.warn(lines.slice(1).join('\n'));
            } else {
              console.warn(formatted);
            }
          },
          debug: (o: any) => {
            const formatted = formatLogMessage(o);
            const lines = formatted.split('\n');
            if (lines.length > 1) {
              console.debug(lines[0]);
              console.debug(lines.slice(1).join('\n'));
            } else {
              console.debug(formatted);
            }
          },
        },
      },
    };
  } else {
    // Node.js configuration with custom formatting
    return {
      level: levelString,
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

// Function to create base logger with current log level
// Base logger should always be at TRACE level to allow child loggers to control their own levels
const createBaseLogger = (): pino.Logger => {
  // Always create base logger at TRACE level so child loggers can set their own levels
  const baseLoggerOptions = getBaseLoggerOptions(LogLevel.TRACE);
  
  if (isBrowser) {
    return pino(baseLoggerOptions);
  } else {
    // Create a custom stream that formats output like SLF4J/Log4J
    const stream = {
      write: (log: string) => {
        try {
          const logObj = JSON.parse(log);
          const formatted = formatLogMessage(logObj);
          // Map pino levels to console methods
          const logLevel = logObj.level;
          if (logLevel >= 50) {
            process.stderr.write(formatted + '\n');
          } else if (logLevel >= 40) {
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
    return pino(baseLoggerOptions, stream);
  }
};

// Base logger instance - always at TRACE level to allow child loggers to control filtering
let baseLogger: pino.Logger = createBaseLogger();

// Cache for logger instances
const loggerCache = new Map<string, Logger>();

export class Logger {
  private pinoLogger: pino.Logger;
  private context: string;
  private logLevel: number;

  private constructor(context: string, level?: number) {
    this.context = context;
    this.logLevel = level || globalLogLevel;
    // Create a child logger with the context
    this.pinoLogger = baseLogger.child({ context });
    // Set the level on the child logger for filtering (pino expects string)
    this.pinoLogger.level = levelNumberToString(this.logLevel).toLowerCase();
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

  /**
   * Log a debug message with optional data object (pretty printed)
   */
  debug(message: string, data?: Record<string, unknown>): void {
    // Check if DEBUG level is enabled (DEBUG = 20)
    if (this.logLevel <= LogLevel.DEBUG) {
      if (data) {
        this.pinoLogger.debug(data, message);
      } else {
        this.pinoLogger.debug(message);
      }
    }
  }

  /**
   * Log an info message with optional data object (pretty printed)
   */
  info(message: string, data?: Record<string, unknown>): void {
    // Check if INFO level is enabled (INFO = 30)
    if (this.logLevel <= LogLevel.INFO) {
      if (data) {
        this.pinoLogger.info(data, message);
      } else {
        this.pinoLogger.info(message);
      }
    }
  }

  /**
   * Log a warning message with optional data object (pretty printed)
   */
  warn(message: string, data?: Record<string, unknown>): void {
    // Check if WARN level is enabled (WARN = 40)
    if (this.logLevel <= LogLevel.WARN) {
      if (data) {
        this.pinoLogger.warn(data, message);
      } else {
        this.pinoLogger.warn(message);
      }
    }
  }

  /**
   * Log an error message with optional data object (pretty printed)
   */
  error(message: string, data?: Record<string, unknown>): void {
    // Check if ERROR level is enabled (ERROR = 50)
    if (this.logLevel <= LogLevel.ERROR) {
      if (data) {
        this.pinoLogger.error(data, message);
      } else {
        this.pinoLogger.error(message);
      }
    }
  }

  /**
   * Get the context for this logger instance
   */
  getContext(): string {
    return this.context;
  }

  /**
   * Set the log level for this logger instance
   * @param level - The log level to set (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
   */
  setLevel(level: LogLevel | string): void {
    const numericLevel = typeof level === 'string' ? levelStringToNumber(level) : level;
    this.logLevel = numericLevel;
    // Create a new child logger with the updated level
    // Pino will filter logs based on this level
    this.pinoLogger = baseLogger.child({ context: this.context });
    // Set the level on the child logger directly (pino expects string)
    this.pinoLogger.level = levelNumberToString(numericLevel).toLowerCase();
  }

  /**
   * Get the current log level for this logger instance
   * @returns The current log level as a string
   */
  getLevel(): string {
    return levelNumberToString(this.logLevel);
  }

  /**
   * Get the current log level as a number
   * @returns The current log level as a number
   */
  getLevelNumber(): number {
    return this.logLevel;
  }

  /**
   * Set the global log level for all loggers
   * @param level - The log level to set (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
   */
  static setGlobalLevel(level: LogLevel | string): void {
    const numericLevel = typeof level === 'string' ? levelStringToNumber(level) : level;
    globalLogLevel = numericLevel;
    // Base logger stays at TRACE, but update all cached loggers to use the new global level
    loggerCache.forEach((logger) => {
      logger.setLevel(numericLevel);
    });
  }

  /**
   * Get the global log level
   * @returns The global log level as a string
   */
  static getGlobalLevel(): string {
    return levelNumberToString(globalLogLevel);
  }

  /**
   * Get the global log level as a number
   * @returns The global log level as a number
   */
  static getGlobalLevelNumber(): number {
    return globalLogLevel;
  }
}
