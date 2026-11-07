import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AUTH_MODE_KEY } from '../decorators/auth-mode.decorator.js';
import { SupabaseJwtVerifier } from '../supabase-jwt-verifier.service.js';
import { TokenRevocationService } from '../services/token-revocation.service.js';
import { AUTH_COOKIES, type RouteAuthMode } from '@app/contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SupabaseJwtVerifier)
    private readonly jwtVerifier: SupabaseJwtVerifier,
    @Optional()
    @Inject(TokenRevocationService)
    private readonly revocationService?: TokenRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const authMode = this.reflector.getAllAndOverride<RouteAuthMode>(AUTH_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    // If route is marked public or passthrough, allow through
    if (isPublic || authMode === 'public' || authMode === 'passthrough') {
      if (token) {
        try {
          const user = await this.jwtVerifier.verifyToken(token);
          request.user = user;
        } catch {
          // Soft-fail on public routes if token is invalid/expired
        }
      }
      return true;
    }

    // Default deny: Requires valid token
    if (!token) {
      throw new UnauthorizedException('Authentication required: Missing token');
    }

    const user = await this.jwtVerifier.verifyToken(token);

    // Check Redis revocation denylist if service is available
    if (this.revocationService) {
      const isRevoked = await this.revocationService.isRevoked({
        userId: user.id,
        sessionId: user.sessionId,
      });

      if (isRevoked) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    request.user = user;
    return true;
  }

  /**
   * Extracts token from Authorization header first, then fallback to session cookies
   */
  private extractToken(request: any): string | null {
    // 1. Authorization: Bearer <token>
    const authHeader = request.headers?.['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) return token;
    }

    // 2. Cookies (either parsed object or raw header)
    if (request.cookies) {
      if (request.cookies[AUTH_COOKIES.ACCESS_TOKEN]) {
        return request.cookies[AUTH_COOKIES.ACCESS_TOKEN];
      }
      if (request.cookies[AUTH_COOKIES.DEV_ACCESS_TOKEN]) {
        return request.cookies[AUTH_COOKIES.DEV_ACCESS_TOKEN];
      }
    }

    const rawCookie = request.headers?.['cookie'];
    if (rawCookie && typeof rawCookie === 'string') {
      const parsed = this.parseCookies(rawCookie);
      if (parsed[AUTH_COOKIES.ACCESS_TOKEN]) {
        return parsed[AUTH_COOKIES.ACCESS_TOKEN];
      }
      if (parsed[AUTH_COOKIES.DEV_ACCESS_TOKEN]) {
        return parsed[AUTH_COOKIES.DEV_ACCESS_TOKEN];
      }
    }

    return null;
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const list: Record<string, string> = {};
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        list[key] = decodeURIComponent(value);
      }
    });
    return list;
  }
}
