import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SERVICE_SCOPE_KEY } from '../decorators/service-only.decorator.js';
import type { AuthenticatedUser } from '@app/contracts';

export interface ServiceAuthenticatedUser extends AuthenticatedUser {
  scopes?: string[];
  isService?: boolean;
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string>(SERVICE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as ServiceAuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Access denied: no authenticated principal');
    }

    // A service token must either have role 'service', or role 'admin', or specific scope
    const isService =
      user.isService === true ||
      user.roles?.includes('service') ||
      user.roles?.includes('admin');

    const hasScope =
      user.scopes?.includes(requiredScope) ||
      user.roles?.includes(`scope:${requiredScope}`) ||
      user.roles?.includes('admin');

    if (!isService || !hasScope) {
      throw new ForbiddenException(
        `Access denied: requires service principal with scope "${requiredScope}"`,
      );
    }

    return true;
  }
}
