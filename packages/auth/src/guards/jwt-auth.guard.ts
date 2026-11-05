import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtVerifierService } from '../jwt-verifier.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const user = await this.jwtVerifier.verifyToken(token);
      request.user = user;
      return true;
    }

    // Only allow forwarded headers if explicitly configured on internal microservices behind gateway
    const trustForwarded = process.env.TRUST_FORWARDED_AUTH === 'true';
    if (trustForwarded) {
      const forwardedUserId = request.headers['x-user-id'];
      const forwardedUserEmail = request.headers['x-user-email'];

      if (forwardedUserId && forwardedUserEmail) {
        request.user = {
          id: String(forwardedUserId),
          email: String(forwardedUserEmail),
          role: (request.headers['x-user-role'] as string) || 'authenticated',
        };
        return true;
      }
    }

    throw new UnauthorizedException('Authentication credentials missing or invalid');
  }
}
