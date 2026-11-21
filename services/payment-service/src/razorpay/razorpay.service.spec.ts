import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { RazorpayService } from './razorpay.service.js';
import { PaymentConfigService } from '../config/payment.config.js';

describe('RazorpayService', () => {
  let service: RazorpayService;
  let config: PaymentConfigService;

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_samplekey123';
    process.env.RAZORPAY_KEY_SECRET = 'sample_secret_456';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'sample_webhook_secret_789';
    config = new PaymentConfigService();
    service = new RazorpayService(config);
  });

  it('creates an order in test/mock mode with correct attributes', async () => {
    const order = await service.createOrder({
      amount: 49900,
      currency: 'INR',
      receipt: 'rcpt_test_1',
      notes: { workshopSlug: 'http-server' },
    });

    expect(order).toBeDefined();
    expect(order.id).toMatch(/^order_/);
    expect(order.amount).toBe(49900);
    expect(order.currency).toBe('INR');
    expect(order.status).toBe('created');
    expect(order.receipt).toBe('rcpt_test_1');
  });

  it('correctly validates a valid checkout payment HMAC signature', () => {
    const orderId = 'order_12345';
    const paymentId = 'pay_67890';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(payload)
      .digest('hex');

    const isValid = service.verifyPaymentSignature(orderId, paymentId, validSignature);
    expect(isValid).toBe(true);
  });

  it('rejects a tampered checkout payment signature', () => {
    const orderId = 'order_12345';
    const paymentId = 'pay_67890';
    const forgedSignature = 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb';

    const isValid = service.verifyPaymentSignature(orderId, paymentId, forgedSignature);
    expect(isValid).toBe(false);
  });

  it('correctly validates a valid webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
    const validSignature = crypto
      .createHmac('sha256', config.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = service.verifyWebhookSignature(rawBody, validSignature);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
    const invalidSignature = 'invalid_signature_hex';

    const isValid = service.verifyWebhookSignature(rawBody, invalidSignature);
    expect(isValid).toBe(false);
  });
});
