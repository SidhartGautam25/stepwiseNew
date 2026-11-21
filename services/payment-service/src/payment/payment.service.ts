import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RazorpayService } from '../razorpay/razorpay.service.js';
import { RabbitMqPublisherService } from '../rabbitmq/rabbitmq-publisher.service.js';
import { PaymentConfigService } from '../config/payment.config.js';
import type {
  CreatePaymentOrderDto,
  VerifyPaymentDto,
  PaymentOrderResponseDto,
  PaymentVerifyResponseDto,
  PaymentHistoryItemDto,
} from '@app/contracts';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly rabbitmq: RabbitMqPublisherService,
    private readonly config: PaymentConfigService,
  ) {}

  /**
   * Determine price for a workshop (custom pricing table with default fallback)
   */
  async getWorkshopPrice(workshopSlug: string): Promise<{ amount: number; currency: string }> {
    const customPrice = await this.prisma.workshopPricing.findUnique({
      where: { workshopSlug },
    });

    if (customPrice && customPrice.isActive) {
      return { amount: customPrice.amount, currency: customPrice.currency };
    }

    return {
      amount: this.config.defaultWorkshopPricePaise,
      currency: 'INR',
    };
  }

  /**
   * Create a new payment order for a workshop
   */
  async createOrder(
    userId: string,
    userEmail: string,
    dto: CreatePaymentOrderDto,
  ): Promise<PaymentOrderResponseDto> {
    // 1. Check if user already purchased and paid for this workshop
    const existingPaid = await this.prisma.paymentOrder.findFirst({
      where: {
        userId,
        workshopSlug: dto.workshopSlug,
        status: 'PAID',
      },
    });

    if (existingPaid) {
      throw new ConflictException(
        `Workshop [${dto.workshopSlug}] is already purchased by this user.`,
      );
    }

    // 2. Fetch pricing
    const pricing = await this.getWorkshopPrice(dto.workshopSlug);
    const receipt = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 3. Create Order on Razorpay
    const rzpOrder = await this.razorpay.createOrder({
      amount: pricing.amount,
      currency: dto.currency || pricing.currency,
      receipt,
      notes: {
        userId,
        workshopSlug: dto.workshopSlug,
        userEmail,
      },
    });

    // 4. Save PaymentOrder to PostgreSQL
    const order = await this.prisma.paymentOrder.create({
      data: {
        orderId: rzpOrder.id,
        userId,
        workshopSlug: dto.workshopSlug,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        status: 'CREATED',
        receipt,
        notesJson: rzpOrder.notes,
      },
    });

    return {
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: this.config.razorpayKeyId,
      workshopSlug: order.workshopSlug,
      status: order.status as any,
      receipt: order.receipt,
      notes: order.notesJson as Record<string, unknown> | undefined,
      createdAt: order.createdAt.toISOString(),
    };
  }

  /**
   * Verify signature and complete payment
   */
  async verifyPayment(
    userId: string,
    dto: VerifyPaymentDto,
  ): Promise<PaymentVerifyResponseDto> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderId: dto.razorpayOrderId },
    });

    if (!order) {
      throw new NotFoundException(`Order [${dto.razorpayOrderId}] not found`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order does not belong to the authenticated user');
    }

    // Check if already paid (idempotent return)
    if (order.status === 'PAID') {
      return {
        success: true,
        orderId: order.orderId,
        paymentId: dto.razorpayPaymentId,
        workshopSlug: order.workshopSlug,
        status: 'PAID',
        message: 'Payment already verified and completed.',
      };
    }

    // Verify HMAC-SHA256 signature
    const isValid = this.razorpay.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValid) {
      this.logger.warn(
        `Invalid signature verification attempt for order [${dto.razorpayOrderId}] and payment [${dto.razorpayPaymentId}]`,
      );
      throw new BadRequestException('Invalid payment signature verification failed');
    }

    // Fetch payment details (optional metadata)
    const paymentDetails = await this.razorpay.fetchPayment(dto.razorpayPaymentId);

    // Save transaction and update order to PAID in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { orderId: order.orderId },
        data: { status: 'PAID' },
      });

      await tx.paymentTransaction.upsert({
        where: { paymentId: dto.razorpayPaymentId },
        create: {
          orderId: order.orderId,
          paymentId: dto.razorpayPaymentId,
          signature: dto.razorpaySignature,
          method: paymentDetails?.method || 'unknown',
          status: 'captured',
          amount: order.amount,
          currency: order.currency,
        },
        update: {
          status: 'captured',
          signature: dto.razorpaySignature,
        },
      });
    });

    // Publish payment.succeeded domain event to RabbitMQ
    await this.rabbitmq.publishPaymentSucceeded({
      orderId: order.orderId,
      paymentId: dto.razorpayPaymentId,
      userId: order.userId,
      workshopSlug: order.workshopSlug,
      amount: order.amount,
      currency: order.currency,
      paidAt: new Date().toISOString(),
    });

    return {
      success: true,
      orderId: order.orderId,
      paymentId: dto.razorpayPaymentId,
      workshopSlug: order.workshopSlug,
      status: 'PAID',
      message: 'Payment verified successfully. Workshop enrolled!',
    };
  }

  /**
   * Handle Razorpay Webhook Event
   */
  async handleWebhook(rawBody: string, signature: string, payload: any): Promise<{ received: boolean }> {
    const isValid = this.razorpay.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Rejected webhook: invalid x-razorpay-signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;
    const eventType = payload.event || 'unknown';

    // Strict deduplication using WebhookEvent table
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (existing) {
      this.logger.log(`Webhook [${eventId}] already processed. Skipping duplicate.`);
      return { received: true };
    }

    await this.prisma.webhookEvent.create({
      data: {
        id: eventId,
        eventType,
        payloadJson: payload,
      },
    });

    // Handle payment.captured or order.paid
    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const order = await this.prisma.paymentOrder.findUnique({
          where: { orderId },
        });

        if (order && order.status !== 'PAID') {
          await this.prisma.$transaction(async (tx) => {
            await tx.paymentOrder.update({
              where: { orderId },
              data: { status: 'PAID' },
            });

            if (paymentId) {
              await tx.paymentTransaction.upsert({
                where: { paymentId },
                create: {
                  orderId,
                  paymentId,
                  status: 'captured',
                  method: paymentEntity?.method || 'webhook',
                  amount: order.amount,
                  currency: order.currency,
                },
                update: { status: 'captured' },
              });
            }
          });

          // Trigger downstream event
          await this.rabbitmq.publishPaymentSucceeded({
            orderId: order.orderId,
            paymentId: paymentId || `pay_wh_${Date.now()}`,
            userId: order.userId,
            workshopSlug: order.workshopSlug,
            amount: order.amount,
            currency: order.currency,
            paidAt: new Date().toISOString(),
          });
        }
      }
    }

    return { received: true };
  }

  /**
   * Get payment history for the authenticated user
   */
  async getUserPaymentHistory(userId: string): Promise<PaymentHistoryItemDto[]> {
    const orders = await this.prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      workshopSlug: o.workshopSlug,
      amount: o.amount,
      currency: o.currency,
      status: o.status as any,
      createdAt: o.createdAt.toISOString(),
      paymentId: o.transactions[0]?.paymentId || null,
    }));
  }

  /**
   * Get specific order details
   */
  async getOrder(userId: string, orderId: string): Promise<PaymentOrderResponseDto> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order [${orderId}] not found`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order does not belong to the user');
    }

    return {
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: this.config.razorpayKeyId,
      workshopSlug: order.workshopSlug,
      status: order.status as any,
      receipt: order.receipt,
      notes: order.notesJson as Record<string, unknown> | undefined,
      createdAt: order.createdAt.toISOString(),
    };
  }

  /**
   * Internal query: check if user owns/purchased a workshop
   */
  async getWorkshopPurchaseStatus(
    userId: string,
    workshopSlug: string,
  ): Promise<{ purchased: boolean; orderId?: string; paidAt?: string }> {
    const paidOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        userId,
        workshopSlug,
        status: 'PAID',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (paidOrder) {
      return {
        purchased: true,
        orderId: paidOrder.orderId,
        paidAt: paidOrder.updatedAt.toISOString(),
      };
    }

    return { purchased: false };
  }

  /**
   * Set custom pricing for a workshop
   */
  async setWorkshopPrice(workshopSlug: string, amount: number, currency = 'INR') {
    return this.prisma.workshopPricing.upsert({
      where: { workshopSlug },
      create: { workshopSlug, amount, currency, isActive: true },
      update: { amount, currency, isActive: true },
    });
  }
}
