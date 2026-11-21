import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const PaymentConfigSchema = z.object({
  PORT: z.coerce.number().default(4007),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL_PAYMENT: z.string().default(
    'postgresql://handrail:handrail_password@localhost:5432/handrail_db?schema=payment_svc',
  ),
  RABBITMQ_URL: z.string().default('amqp://handrail:handrail_password@localhost:5672'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_placeholder'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_placeholder'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_placeholder'),
  SUPABASE_JWT_SECRET: z.string().default('super-secret-jwt-token-with-minimum-32-chars-long!'),
  SERVICE_SECRET: z.string().default('dev_internal_sync_token_secret'),
  DEFAULT_WORKSHOP_PRICE_PAISE: z.coerce.number().default(49900), // Default ₹499
});

export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;

@Injectable()
export class PaymentConfigService {
  readonly config: PaymentConfig;

  constructor() {
    this.config = PaymentConfigSchema.parse(process.env);
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL_PAYMENT;
  }

  get rabbitmqUrl(): string {
    return this.config.RABBITMQ_URL;
  }

  get razorpayKeyId(): string {
    return this.config.RAZORPAY_KEY_ID;
  }

  get razorpayKeySecret(): string {
    return this.config.RAZORPAY_KEY_SECRET;
  }

  get razorpayWebhookSecret(): string {
    return this.config.RAZORPAY_WEBHOOK_SECRET;
  }

  get supabaseJwtSecret(): string {
    return this.config.SUPABASE_JWT_SECRET;
  }

  get serviceSecret(): string {
    return this.config.SERVICE_SECRET;
  }

  get defaultWorkshopPricePaise(): number {
    return this.config.DEFAULT_WORKSHOP_PRICE_PAISE;
  }
}
