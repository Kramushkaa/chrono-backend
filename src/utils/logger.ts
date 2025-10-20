/**
 * Structured logging utility
 */

interface LogContext {
  userId?: number;
  action?: string;
  duration?: number;
  error?: Error;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: LogContext;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private formatLog(level: string, message: string, context?: LogContext): string {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level as LogEntry['level'],
      message,
      ...(context && { context }),
    };

    if (this.isProduction) {
      // В production используем JSON формат для парсинга логов
      return JSON.stringify(logEntry);
    } else {
      // В development используем удобочитаемый формат
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      return `[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }
  }

  private writeLog(level: string, message: string, context?: LogContext): void {
    const formattedLog = this.formatLog(level, message, context);
    
    switch (level) {
      case 'error':
        console.error(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'debug':
        if (!this.isProduction) {
          console.debug(formattedLog);
        }
        break;
      default:
        console.log(formattedLog);
    }
  }

  info(message: string, context?: LogContext): void {
    this.writeLog('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.writeLog('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.writeLog('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.writeLog('debug', message, context);
  }

  // Специальные методы для common scenarios

  /**
   * Логирование ошибок базы данных
   */
  dbError(message: string, error: Error, query?: string, params?: unknown[]): void {
    this.error(`Database error: ${message}`, {
      error,
      query,
      params,
      action: 'db_operation',
    });
  }

  /**
   * Логирование ошибок аутентификации
   */
  authError(message: string, userId?: number, details?: string): void {
    this.warn(`Authentication error: ${message}`, {
      userId,
      details,
      action: 'authentication',
    });
  }

  /**
   * Логирование медленных запросов
   */
  slowQuery(duration: number, query: string, params?: unknown[]): void {
    if (duration > 1000) {
      this.warn(`Slow query detected: ${duration}ms`, {
        duration,
        query,
        params,
        action: 'slow_query',
      });
    }
  }

  /**
   * Логирование ошибок сервисов
   */
  serviceError(service: string, operation: string, error: Error, context?: LogContext): void {
    this.error(`Service error: ${service}.${operation}`, {
      service,
      operation,
      error,
      ...context,
    });
  }
}

// Создаем глобальный экземпляр logger
export const logger = new Logger();

// Экспортируем класс для тестирования
export { Logger };
