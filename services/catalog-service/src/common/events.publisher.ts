import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import * as crypto from 'node:crypto';
import { CatalogConfigService } from '../config/catalog.config.js';

export const PLATFORM_EVENTS_EXCHANGE = 'platform.events';

@Injectable()
export class EventsPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsPublisherService.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(private readonly config: CatalogConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = amqp.connect([this.config.rabbitmqUrl]);
      this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ for event publishing.'));
      this.connection.on('disconnect', (err) =>
        this.logger.warn(`Disconnected from RabbitMQ: ${err?.err?.message || 'unknown'}`),
      );

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: any) => {
          await channel.assertExchange(PLATFORM_EVENTS_EXCHANGE, 'topic', { durable: true });
        },
      });
      await this.channelWrapper.waitForConnect();
    } catch (err: any) {
      this.logger.warn(`RabbitMQ event publisher init warning: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  async publish(routingKey: string, payload: unknown, correlationId?: string): Promise<void> {
    const envelope = {
      eventId: crypto.randomUUID(),
      type: routingKey,
      version: '1.0',
      occurredAt: new Date().toISOString(),
      correlationId: correlationId || crypto.randomUUID(),
      data: payload,
    };

    if (!this.channelWrapper) {
      this.logger.warn(`RabbitMQ not connected, dropping event: ${routingKey}`);
      return;
    }

    try {
      await this.channelWrapper.publish(
        PLATFORM_EVENTS_EXCHANGE,
        routingKey,
        envelope,
        { contentType: 'application/json', persistent: true },
      );
      this.logger.log(`Published event: [${routingKey}]`);
    } catch (err: any) {
      this.logger.error(`Failed to publish event [${routingKey}]: ${err.message}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.connection ? this.connection.isConnected() : false;
  }
}
