import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { EventEnvelope } from '@app/contracts';

export const PLATFORM_EVENTS_EXCHANGE = 'platform.events';
export const PLATFORM_EVENTS_DLX = 'platform.events.dlx';

@Injectable()
export class RabbitMqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private connection: AmqpConnectionManager | null = null;
  private channelWrapper: ChannelWrapper | null = null;
  private isConnected = false;

  async onModuleInit() {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://handrail:handrail_password@localhost:5672';
    this.connect(rabbitmqUrl);
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
          // Declare durable dead letter exchange
          await channel.assertExchange(PLATFORM_EVENTS_DLX, 'topic', { durable: true });
          // Declare primary durable topic exchange
          await channel.assertExchange(PLATFORM_EVENTS_EXCHANGE, 'topic', { durable: true });
          this.logger.log(`Asserted RabbitMQ exchanges: ${PLATFORM_EVENTS_EXCHANGE}, ${PLATFORM_EVENTS_DLX}`);
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize RabbitMQ connection: ${err.message}`);
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

  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Publishes an event to the platform.events topic exchange with publisher confirms.
   * Resolves only when the RabbitMQ broker confirms message delivery to disk/exchange.
   */
  async publishEvent<T>(routingKey: string, envelope: EventEnvelope<T>): Promise<boolean> {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ channel wrapper is not initialized');
    }

    try {
      await this.channelWrapper.publish(
        PLATFORM_EVENTS_EXCHANGE,
        routingKey,
        envelope,
        {
          contentType: 'application/json',
          persistent: true, // Messages marked persistent survive broker restart
          messageId: envelope.eventId,
          timestamp: new Date(envelope.occurredAt).getTime(),
          type: envelope.type,
        },
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to publish event [${envelope.type}] to exchange ${PLATFORM_EVENTS_EXCHANGE}: ${err.message}`,
      );
      throw err;
    }
  }
}
