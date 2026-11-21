import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfileConfigService {
  get port(): number {
    return Number(process.env.PORT_PROFILE || 4004);
  }

  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL_PROFILE ||
      'postgresql://handrail:handrail_password@localhost:5432/handrail_db?schema=profile_svc'
    );
  }

  get rabbitmqUrl(): string {
    return process.env.RABBITMQ_URL || 'amqp://handrail:handrail_password@localhost:5672';
  }

  get paymentServiceUrl(): string {
    const raw = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:4007';
    return raw.replace('//localhost:', '//127.0.0.1:');
  }

  get serviceSecret(): string {
    return process.env.SERVICE_SECRET || 'dev_internal_sync_token_secret';
  }
}
