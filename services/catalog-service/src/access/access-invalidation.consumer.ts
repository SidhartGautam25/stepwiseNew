import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CatalogConfigService } from '../config/catalog.config.js';
import { CachedAccessPolicyService } from './cached-access-policy.service.js';
import { PLATFORM_EVENTS_EXCHANGE } from '../common/events.publisher.js';

export const ACCESS_INVALIDATION_QUEUE = 'catalog.access.invalidation';

@Injectable()
export class AccessInvalidationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccessInvalidationConsumer.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(
    private readonly config: CatalogConfigService,
    private readonly cachedAccessPolicy: CachedAccessPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = amqp.connect([this.config.rabbitmqUrl]);
      this.connection.on('connect', () =>
        this.logger.log('AccessInvalidationConsumer connected to RabbitMQ.'),
      );
      this.connection.on('disconnect', (err) =>
        this.logger.warn(`AccessInvalidationConsumer disconnected: ${err?.err?.message || 'unknown'}`),
      );

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: Channel) => {
          await channel.assertExchange(PLATFORM_EVENTS_EXCHANGE, 'topic', { durable: true });
          await channel.assertQueue(ACCESS_INVALIDATION_QUEUE, { durable: true });

          // Bind invalidation event routing patterns
          await channel.bindQueue(ACCESS_INVALIDATION_QUEUE, PLATFORM_EVENTS_EXCHANGE, 'profile.enrollment.created');
          await channel.bindQueue(ACCESS_INVALIDATION_QUEUE, PLATFORM_EVENTS_EXCHANGE, 'profile.chapter.passed');
          await channel.bindQueue(ACCESS_INVALIDATION_QUEUE, PLATFORM_EVENTS_EXCHANGE, 'profile.step.passed');

          await channel.consume(
            ACCESS_INVALIDATION_QUEUE,
            async (msg: ConsumeMessage | null) => {
              if (!msg) return;
              try {
                const event = JSON.parse(msg.content.toString('utf-8'));
                const data = event.data || event;
                const userId = data.userId;
                const workshopSlug = data.workshopSlug;

                if (userId && workshopSlug) {
                  await this.cachedAccessPolicy.invalidate(userId, workshopSlug);
                }

                channel.ack(msg);
              } catch (err: any) {
                this.logger.warn(`Error processing access invalidation event: ${err.message}`);
                channel.ack(msg); // Ack to avoid stuck poison pills
              }
            },
            { noAck: false },
          );
        },
      });

      await this.channelWrapper.waitForConnect();
    } catch (err: any) {
      this.logger.warn(`RabbitMQ access invalidation consumer init warning: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
