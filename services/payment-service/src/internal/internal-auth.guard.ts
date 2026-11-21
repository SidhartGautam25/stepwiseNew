import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentConfigService } from '../config/payment.config.js';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: PaymentConfigService) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (serviceToken === this.config.serviceSecret) {
      request.user = {
        id: 'service-principal',
        roles: ['service'],
        scopes: ['payment:read', 'payment:write'],
        isService: true,
      };
      return true;
    }

    throw new UnauthorizedException('Invalid service token for internal API');
  }
}
