import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'node:crypto';
import { PaymentService } from './payment.service.js';
import { RazorpayService } from '../razorpay/razorpay.service.js';
import { PaymentConfigService } from '../config/payment.config.js';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockRazorpay: any;
  let mockRabbitmq: any;
  let config: PaymentConfigService;

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_test';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_test';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_test';
    config = new PaymentConfigService();

    mockPrisma = {
      workshopPricing: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      paymentOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          ...data,
          id: 'order-uuid-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        update: vi.fn(),
      },
      paymentTransaction: {
        upsert: vi.fn(),
      },
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    mockRazorpay = {
      createOrder: vi.fn().mockResolvedValue({
        id: 'order_rzp_123',
        amount: 49900,
        currency: 'INR',
        receipt: 'rcpt_1',
        notes: { workshopSlug: 'http-server' },
      }),
      verifyPaymentSignature: vi.fn().mockReturnValue(true),
      verifyWebhookSignature: vi.fn().mockReturnValue(true),
      fetchPayment: vi.fn().mockResolvedValue({ method: 'upi' }),
    };

    mockRabbitmq = {
      publishPaymentSucceeded: vi.fn().mockResolvedValue(undefined),
    };

    service = new PaymentService(
      mockPrisma as any,
      mockRazorpay as any,
      mockRabbitmq as any,
      config,
    );
  });

  describe('createOrder', () => {
    it('creates an order when user has not purchased yet', async () => {
      const order = await service.createOrder('user-1', 'user@example.com', {
        workshopSlug: 'http-server',
      });

      expect(order).toBeDefined();
      expect(order.orderId).toBe('order_rzp_123');
      expect(order.amount).toBe(49900);
      expect(order.workshopSlug).toBe('http-server');
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalled();
    });

    it('throws ConflictException if user already paid for this workshop', async () => {
      mockPrisma.paymentOrder.findFirst.mockResolvedValueOnce({
        id: 'existing-order',
        status: 'PAID',
      });

      await expect(
        service.createOrder('user-1', 'user@example.com', { workshopSlug: 'http-server' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyPayment', () => {
    it('verifies signature, updates order to PAID, and emits domain event', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValueOnce({
        orderId: 'order_rzp_123',
        userId: 'user-1',
        workshopSlug: 'http-server',
        amount: 49900,
        currency: 'INR',
        status: 'CREATED',
      });

      const res = await service.verifyPayment('user-1', {
        razorpayOrderId: 'order_rzp_123',
        razorpayPaymentId: 'pay_999',
        razorpaySignature: 'valid_sig',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('PAID');
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order_rzp_123' },
          data: { status: 'PAID' },
        }),
      );
      expect(mockRabbitmq.publishPaymentSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order_rzp_123',
          paymentId: 'pay_999',
          userId: 'user-1',
          workshopSlug: 'http-server',
        }),
      );
    });

    it('throws BadRequestException if signature is invalid', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValueOnce({
        orderId: 'order_rzp_123',
        userId: 'user-1',
        workshopSlug: 'http-server',
        status: 'CREATED',
      });
      mockRazorpay.verifyPaymentSignature.mockReturnValueOnce(false);

      await expect(
        service.verifyPayment('user-1', {
          razorpayOrderId: 'order_rzp_123',
          razorpayPaymentId: 'pay_999',
          razorpaySignature: 'forged_sig',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('is idempotent if already PAID', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValueOnce({
        orderId: 'order_rzp_123',
        userId: 'user-1',
        workshopSlug: 'http-server',
        status: 'PAID',
      });

      const res = await service.verifyPayment('user-1', {
        razorpayOrderId: 'order_rzp_123',
        razorpayPaymentId: 'pay_999',
        razorpaySignature: 'any_sig',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('PAID');
      expect(mockRabbitmq.publishPaymentSucceeded).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('processes order.paid webhook and marks order paid', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValueOnce({
        orderId: 'order_rzp_123',
        userId: 'user-1',
        workshopSlug: 'http-server',
        amount: 49900,
        currency: 'INR',
        status: 'CREATED',
      });

      const payload = {
        event: 'order.paid',
        event_id: 'evt_123',
        payload: {
          order: { entity: { id: 'order_rzp_123' } },
          payment: { entity: { id: 'pay_123', order_id: 'order_rzp_123' } },
        },
      };

      const res = await service.handleWebhook(JSON.stringify(payload), 'sig_valid', payload);
      expect(res.received).toBe(true);
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalled();
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalled();
      expect(mockRabbitmq.publishPaymentSucceeded).toHaveBeenCalled();
    });

    it('skips duplicate webhook events gracefully', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValueOnce({ id: 'evt_123' });

      const payload = { event: 'order.paid', id: 'evt_123' };
      const res = await service.handleWebhook('{}', 'sig_valid', payload);
      expect(res.received).toBe(true);
      expect(mockPrisma.paymentOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('getWorkshopPurchaseStatus', () => {
    it('returns purchased: true when paid order exists', async () => {
      mockPrisma.paymentOrder.findFirst.mockResolvedValueOnce({
        orderId: 'order_rzp_123',
        updatedAt: new Date('2026-01-01'),
      });

      const status = await service.getWorkshopPurchaseStatus('user-1', 'http-server');
      expect(status.purchased).toBe(true);
      expect(status.orderId).toBe('order_rzp_123');
    });

    it('returns purchased: false when no paid order exists', async () => {
      mockPrisma.paymentOrder.findFirst.mockResolvedValueOnce(null);

      const status = await service.getWorkshopPurchaseStatus('user-1', 'http-server');
      expect(status.purchased).toBe(false);
    });
  });
});
