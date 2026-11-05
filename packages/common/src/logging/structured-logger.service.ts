import { Injectable, LoggerService, Scope } from '@nestjs/common';

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug' | 'verbose';
  service: string;
  message: string;
  context?: string;
  correlationId?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  stack?: string;
}

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
  private serviceName: string;

  constructor(serviceName?: string) {
    this.serviceName = serviceName || process.env.SERVICE_NAME || 'service';
  }

  setServiceName(name: string) {
    this.serviceName = name;
  }

  private print(entry: LogEntry) {
    const formatted = JSON.stringify(entry);
    if (entry.level === 'error') {
      process.stderr.write(`${formatted}\n`);
    } else {
      process.stdout.write(`${formatted}\n`);
    }
  }

  log(message: any, context?: string, meta?: Record<string, unknown>) {
    this.print({
      level: 'info',
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      meta,
    });
  }

  error(message: any, stack?: string, context?: string, meta?: Record<string, unknown>) {
    this.print({
      level: 'error',
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      stack,
      timestamp: new Date().toISOString(),
      meta,
    });
  }

  warn(message: any, context?: string, meta?: Record<string, unknown>) {
    this.print({
      level: 'warn',
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      meta,
    });
  }

  debug(message: any, context?: string, meta?: Record<string, unknown>) {
    this.print({
      level: 'debug',
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      meta,
    });
  }

  verbose(message: any, context?: string, meta?: Record<string, unknown>) {
    this.print({
      level: 'verbose',
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      meta,
    });
  }
}
