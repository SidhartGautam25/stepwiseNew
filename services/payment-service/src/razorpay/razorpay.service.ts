import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PaymentConfigService } from '../config/payment.config.js';

export interface RazorpayOrderCreationParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPaymentDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method: string;
  email?: string;
  contact?: string;
  error_code?: string;
  error_description?: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(private readonly config: PaymentConfigService) {}

  private get authHeader(): string {
    const creds = `${this.config.razorpayKeyId}:${this.config.razorpayKeySecret}`;
    return `Basic ${Buffer.from(creds).toString('base64')}`;
  }

  /**
   * Create an Order with Razorpay API
   */
  async createOrder(params: RazorpayOrderCreationParams): Promise<RazorpayOrderResponse> {
    const envCheck = this.config.validateEnvironment();
    if (!envCheck.valid) {
      this.logger.error(`Razorpay configuration error: ${envCheck.reason}`);
      throw new BadRequestException(envCheck.reason);
    }

    // In mock mode (e.g. unit tests or offline dev), return a deterministic mocked order
    if (this.config.isMockMode) {
      const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
      this.logger.log(`Mocking Razorpay order creation [${mockOrderId}] for receipt [${params.receipt}]`);
      return {
        id: mockOrderId,
        entity: 'order',
        amount: params.amount,
        amount_paid: 0,
        amount_due: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created',
        attempts: 0,
        notes: params.notes || {},
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Razorpay order creation failed (${res.status}): ${errorText}`);
        throw new BadRequestException(`Failed to create Razorpay order: ${errorText}`);
      }

      return (await res.json()) as RazorpayOrderResponse;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Error contacting Razorpay API: ${err.message}`);
      throw new BadRequestException(`Razorpay gateway error: ${err.message}`);
    }
  }

  /**
   * Verify Client Checkout Signature
   * Formula: HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret) == razorpay_signature
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const envCheck = this.config.validateEnvironment();
    if (!envCheck.valid) {
      this.logger.error(`Razorpay configuration error during signature verification: ${envCheck.reason}`);
      return false;
    }

    // Mock bypass allowed ONLY when mock mode is enabled in test environment
    if (this.config.isMockMode && signature.startsWith('mock_sig_')) {
      return true;
    }

    // Production / Live mode: mock signatures are strictly rejected
    if (!this.config.isTestMode && signature.startsWith('mock_sig_')) {
      this.logger.warn(`Rejected mock signature in production/live mode for order [${orderId}]`);
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.razorpayKeySecret)
      .update(payload)
      .digest('hex');

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Verify Webhook Signature
   * Formula: HMAC_SHA256(rawBody, webhookSecret) == x-razorpay-signature
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature || !rawBody) return false;

    const envCheck = this.config.validateEnvironment();
    if (!envCheck.valid) {
      this.logger.error(`Razorpay configuration error during webhook signature verification: ${envCheck.reason}`);
      return false;
    }

    if (this.config.isMockMode && signature.startsWith('mock_sig_')) {
      return true;
    }

    if (!this.config.isTestMode && signature.startsWith('mock_sig_')) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Fetch payment details from Razorpay
   */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentDetails | null> {
    if (this.config.isMockMode) {
      return {
        id: paymentId,
        entity: 'payment',
        amount: this.config.defaultWorkshopPricePaise,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_mock',
        method: 'upi',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as RazorpayPaymentDetails;
    } catch (err: any) {
      this.logger.warn(`Could not fetch payment [${paymentId}]: ${err.message}`);
      return null;
    }
  }
}
