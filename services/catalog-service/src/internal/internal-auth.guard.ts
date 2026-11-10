import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SERVICE_SCOPE_KEY } from '@app/auth';
import { CatalogConfigService } from '../config/catalog.config.js';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: CatalogConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string>(SERVICE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const serviceToken =
      request.headers['x-service-token'] ||
      (typeof request.headers['authorization'] === 'string' &&
      request.headers['authorization'].startsWith('Bearer ')
        ? request.headers['authorization'].slice(7).trim()
        : null);

    if (!serviceToken) {
      throw new UnauthorizedException('Missing service token for internal API');
    }

    // Check shared secret match
    if (serviceToken === this.config.serviceSecret) {
      // Valid shared service token, grant service scopes
      request.user = {
        id: 'service-principal',
        roles: ['service'],
        scopes: ['catalog:read', 'catalog:tests:read'],
        isService: true,
      };
      return true;
    }

    // If request already has authenticated user (e.g. from upstream JWT)
    const user = request.user;
    if (user) {
      const isService =
        user.isService === true ||
        user.roles?.includes('service') ||
        user.roles?.includes('admin');

      const hasScope =
        !requiredScope ||
        user.scopes?.includes(requiredScope) ||
        user.roles?.includes(`scope:${requiredScope}`) ||
        user.roles?.includes('admin');

      if (isService && hasScope) {
        return true;
      }
    }

    throw new ForbiddenException(
      `Access denied: requires service principal with scope "${requiredScope || 'catalog:read'}"`,
    );
  }
}
