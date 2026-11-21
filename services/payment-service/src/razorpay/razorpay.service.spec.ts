import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'node:crypto';
import { RazorpayService } from './razorpay.service.js';
import { PaymentConfigService } from '../config/payment.config.js';
import { BadRequestException } from '@nestjs/common';

describe('RazorpayService', () => {
  let service: RazorpayService;
  let config: PaymentConfigService;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_U2omF4kGKdXFma';
    process.env.RAZORPAY_KEY_SECRET = 'VKALtbk6gVZW41YYMt1YWBZj';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'VKALtbk6gVZW41YYMt1YWBZj';
    process.env.RAZORPAY_TEST_MODE = 'true';
    process.env.RAZORPAY_MOCK_MODE = 'true';
    config = new PaymentConfigService();
    service = new RazorpayService(config);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Development & Test Mode (test = true)', () => {
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

  describe('Production & Live Mode Switching (test = false)', () => {
    it('detects live mode when TEST=false or RAZORPAY_TEST_MODE=false', () => {
      process.env.RAZORPAY_TEST_MODE = 'false';
      const prodConfig = new PaymentConfigService();
      expect(prodConfig.isTestMode).toBe(false);
      expect(prodConfig.isMockMode).toBe(false);
    });

    it('detects live mode when TEST env var is set to false', () => {
      delete process.env.RAZORPAY_TEST_MODE;
      process.env.TEST = 'false';
      const prodConfig = new PaymentConfigService();
      expect(prodConfig.isTestMode).toBe(false);
    });

    it('rejects test keys (rzp_test_...) when running in live mode (test = false)', async () => {
      process.env.RAZORPAY_TEST_MODE = 'false';
      process.env.RAZORPAY_KEY_ID = 'rzp_test_U2omF4kGKdXFma';
      const prodConfig = new PaymentConfigService();
      const prodService = new RazorpayService(prodConfig);

      await expect(
        prodService.createOrder({
          amount: 49900,
          currency: 'INR',
          receipt: 'rcpt_live_1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('strictly forbids mock signature bypass when test = false', () => {
      process.env.RAZORPAY_TEST_MODE = 'false';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_realproductionkey123';
      process.env.RAZORPAY_KEY_SECRET = 'live_secret_real_456';
      const prodConfig = new PaymentConfigService();
      const prodService = new RazorpayService(prodConfig);

      const isValid = prodService.verifyPaymentSignature('order_1', 'pay_1', 'mock_sig_bypass');
      expect(isValid).toBe(false);
    });

    it('validates genuine live credentials format in production mode', () => {
      process.env.RAZORPAY_TEST_MODE = 'false';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_realproductionkey123';
      process.env.RAZORPAY_KEY_SECRET = 'live_secret_real_456';
      const prodConfig = new PaymentConfigService();

      const validation = prodConfig.validateEnvironment();
      expect(validation.valid).toBe(true);
    });
  });
});
