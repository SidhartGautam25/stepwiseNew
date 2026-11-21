import { Injectable, Logger } from '@nestjs/common';
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
  PROFILE_SERVICE_URL: z.string().default('http://localhost:4004'),
});

export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;

@Injectable()
export class PaymentConfigService {
  private readonly logger = new Logger(PaymentConfigService.name);
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

  get profileServiceUrl(): string {
    const raw = this.config.PROFILE_SERVICE_URL || 'http://127.0.0.1:4004';
    return raw.replace('//localhost:', '//127.0.0.1:');
  }

  get defaultWorkshopPricePaise(): number {
    return this.config.DEFAULT_WORKSHOP_PRICE_PAISE;
  }

  /**
   * Determine whether Razorpay is running in Test or Live mode.
   * In production (NODE_ENV=production), test mode is always false.
   * In development, switches via RAZORPAY_TEST_MODE, RAZORPAY_TEST, or TEST env vars.
   */
  get isTestMode(): boolean {
    if (this.config.NODE_ENV === 'production') {
      return false;
    }

    const testFlag =
      process.env.RAZORPAY_TEST_MODE ??
      process.env.RAZORPAY_TEST ??
      process.env.TEST;

    if (testFlag !== undefined) {
      const lower = testFlag.trim().toLowerCase();
      return lower !== 'false' && lower !== '0';
    }

    return true; // Default to test mode in development and testing
  }

  /**
   * Determine whether mock mode is active (for offline dev or isolated unit testing).
   * Mock mode is strictly forbidden in live/production mode.
   */
  get isMockMode(): boolean {
    if (!this.isTestMode) {
      return false;
    }

    const mockFlag = process.env.RAZORPAY_MOCK_MODE;
    if (mockFlag !== undefined) {
      const lower = mockFlag.trim().toLowerCase();
      return lower === 'true' || lower === '1';
    }

    // Default to mock mode during automated test suites or if using default placeholder keys
    if (this.config.NODE_ENV === 'test' || this.config.RAZORPAY_KEY_ID === 'rzp_test_placeholder') {
      return true;
    }

    return false;
  }

  /**
   * Enforces environment consistency:
   * - Production/Live mode requires rzp_live_ keys.
   * - Test mode requires rzp_test_ keys.
   */
  validateEnvironment(): { valid: boolean; reason?: string } {
    if (!this.isTestMode) {
      if (
        this.razorpayKeyId.startsWith('rzp_test_') ||
        this.razorpayKeyId === 'rzp_test_placeholder'
      ) {
        return {
          valid: false,
          reason: `Production/live mode (test=false) requires live Razorpay credentials (rzp_live_...). Found test key: ${this.razorpayKeyId}`,
        };
      }
    } else {
      if (this.razorpayKeyId.startsWith('rzp_live_')) {
        return {
          valid: false,
          reason: `Test mode (test=true) detected live Razorpay key (${this.razorpayKeyId}). Use test keys (rzp_test_...) or set test=false.`,
        };
      }
    }
    return { valid: true };
  }
}
