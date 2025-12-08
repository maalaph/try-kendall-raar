/**
 * Structured Logger
 * Production-ready logging with context and levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  recordId?: string;
  threadId?: string;
  agentId?: string;
  callId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

class Logger {
  private module: string;
  private defaultContext: LogContext;
  private minLevel: LogLevel;
  
  constructor(module: string, context: LogContext = {}) {
    this.module = module;
    this.defaultContext = context;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
  
  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
    };
    
    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    if (duration !== undefined) {
      entry.duration = duration;
    }
    
    return entry;
  }
  
  private output(entry: LogEntry): void {
    // In production, you might send to external logging service
    // For now, use structured console output
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`;
    
    const data = {
      ...entry.context,
      ...(entry.error ? { error: entry.error } : {}),
      ...(entry.duration !== undefined ? { duration: `${entry.duration}ms` } : {}),
    };
    
    const hasData = Object.keys(data).length > 0;
    
    switch (entry.level) {
      case 'debug':
        if (hasData) {
          console.debug(prefix, entry.message, data);
        } else {
          console.debug(prefix, entry.message);
        }
        break;
      case 'info':
        if (hasData) {
          console.log(prefix, entry.message, data);
        } else {
          console.log(prefix, entry.message);
        }
        break;
      case 'warn':
        if (hasData) {
          console.warn(prefix, entry.message, data);
        } else {
          console.warn(prefix, entry.message);
        }
        break;
      case 'error':
        if (hasData) {
          console.error(prefix, entry.message, data);
        } else {
          console.error(prefix, entry.message);
        }
        break;
    }
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.output(this.formatEntry('error', message, context, err));
    }
  }
  
  /**
   * Log with timing
   */
  timed(message: string, context?: LogContext): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      if (this.shouldLog('info')) {
        this.output(this.formatEntry('info', message, context, undefined, duration));
      }
    };
  }
  
  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.module, {
      ...this.defaultContext,
      ...additionalContext,
    });
    return childLogger;
  }
  
  /**
   * Create logger for a specific request
   */
  forRequest(requestId: string, userId?: string): Logger {
    return this.child({ requestId, userId });
  }
}

/**
 * Create a logger for a module
 */
export function createLogger(module: string, context?: LogContext): Logger {
  return new Logger(module, context);
}

// Pre-configured loggers for common modules
export const loggers = {
  agent: createLogger('AGENT'),
  api: createLogger('API'),
  database: createLogger('DATABASE'),
  vapi: createLogger('VAPI'),
  integrations: createLogger('INTEGRATIONS'),
  auth: createLogger('AUTH'),
  chat: createLogger('CHAT'),
  approval: createLogger('APPROVAL'),
  location: createLogger('LOCATION'),
  documents: createLogger('DOCUMENTS'),
};

// Default export for convenience
export default createLogger;



