import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { EventEnvelope, PaymentSucceededPayload } from '@app/contracts';
import { EVENT_PATTERNS } from '@app/contracts';
import { PaymentConfigService } from '../config/payment.config.js';

export const PLATFORM_EVENTS_EXCHANGE = 'platform.events';
export const PLATFORM_EVENTS_DLX = 'platform.events.dlx';

@Injectable()
export class RabbitMqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private connection: AmqpConnectionManager | null = null;
  private channelWrapper: ChannelWrapper | null = null;
  private isConnected = false;

  constructor(private readonly config: PaymentConfigService) {}

  async onModuleInit() {
    this.connect(this.config.rabbitmqUrl);
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  connect(url: string) {
    try {
      this.connection = amqp.connect([url], {
        heartbeatIntervalInSeconds: 10,
        reconnectTimeInSeconds: 5,
      });

      this.connection.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to RabbitMQ message broker');
      });

      this.connection.on('disconnect', (err) => {
        this.isConnected = false;
        this.logger.warn(`Disconnected from RabbitMQ broker: ${err.err?.message || 'Connection lost'}`);
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: any) => {
          await channel.assertExchange(PLATFORM_EVENTS_DLX, 'topic', { durable: true });
          await channel.assertExchange(PLATFORM_EVENTS_EXCHANGE, 'topic', { durable: true });
          this.logger.log(`Asserted RabbitMQ exchange: ${PLATFORM_EVENTS_EXCHANGE}`);
        },
      });
    } catch (err: any) {
      this.logger.warn(`RabbitMQ connection initialization failed: ${err.message}`);
    }
  }

  async disconnect() {
    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch {
      // Ignored during shutdown
    }
  }

  async publishPaymentSucceeded(payload: PaymentSucceededPayload): Promise<void> {
    const envelope: EventEnvelope<PaymentSucceededPayload> = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: EVENT_PATTERNS.PAYMENT_SUCCEEDED,
      version: '1.0.0',
      occurredAt: payload.paidAt,
      correlationId: `corr_order_${payload.orderId}`,
      data: payload,
    };

    if (!this.channelWrapper || !this.isConnected) {
      this.logger.warn(`RabbitMQ not connected. Skipping publish for [${EVENT_PATTERNS.PAYMENT_SUCCEEDED}]`);
      return;
    }

    try {
      await this.channelWrapper.publish(
        PLATFORM_EVENTS_EXCHANGE,
        EVENT_PATTERNS.PAYMENT_SUCCEEDED,
        envelope,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
        },
      );
      this.logger.log(`Published [${EVENT_PATTERNS.PAYMENT_SUCCEEDED}] for order [${payload.orderId}]`);
    } catch (err: any) {
      this.logger.error(`Failed to publish [${EVENT_PATTERNS.PAYMENT_SUCCEEDED}]: ${err.message}`);
    }
  }
}
