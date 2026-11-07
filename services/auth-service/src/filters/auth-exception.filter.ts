import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '@app/common';

export interface AuthErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  correlationId?: string;
  timestamp: string;
}

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) || '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected authentication error occurred';

    // 1. Standard NestJS HttpExceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        code = obj.code || (status === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR');
        message = obj.message || exception.message;
      } else if (typeof res === 'string') {
        message = res;
      }
    }

    // 2. Map Supabase AuthApiError / AuthError
    const rawMessage = (exception?.message || exception?.error_description || '').toLowerCase();
    const rawCode = (exception?.code || exception?.name || '').toLowerCase();
    const rawStatus = exception?.status;

    if (rawStatus === 429 || rawMessage.includes('rate limit') || rawMessage.includes('too many')) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = 'Too many requests. Please try again later.';
    } else if (
      rawMessage.includes('invalid login credentials') ||
      rawMessage.includes('invalid_grant') ||
      rawMessage.includes('invalid credentials')
    ) {
      status = HttpStatus.UNAUTHORIZED;
      code = 'INVALID_CREDENTIALS';
      message = 'Invalid email or password';
    } else if (rawMessage.includes('email not confirmed')) {
      status = HttpStatus.UNAUTHORIZED;
      code = 'EMAIL_NOT_CONFIRMED';
      message = 'Email address has not been confirmed';
    } else if (
      rawMessage.includes('password') &&
      (rawMessage.includes('least') || rawMessage.includes('weak') || rawMessage.includes('short'))
    ) {
      status = HttpStatus.BAD_REQUEST;
      code = 'WEAK_PASSWORD';
      message = 'Password does not meet complexity requirements';
    } else if (rawCode === 'account_suspended' || rawMessage.includes('account has been suspended')) {
      status = HttpStatus.FORBIDDEN;
      code = 'ACCOUNT_SUSPENDED';
      message = 'This account has been suspended';
    } else if (status === HttpStatus.NOT_FOUND || rawStatus === 404) {
      status = HttpStatus.NOT_FOUND;
      code = 'NOT_FOUND';
      message = exception.message || 'Requested resource not found';
    } else if (rawStatus && rawStatus >= 400 && rawStatus < 500) {
      status = rawStatus;
      code = 'AUTH_FAILED';
      message = 'Authentication request could not be completed';
    }

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] Auth Internal Error: ${exception?.message || exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] Auth Client Error [${code}]: ${message} (Raw: ${exception?.message})`,
      );
    }

    const errorPayload: AuthErrorResponse = {
      statusCode: status,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorPayload);
  }
}
