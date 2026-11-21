import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy, forwardRef } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { EventEnvelope, PaymentSucceededPayload } from '@app/contracts';
import { EVENT_PATTERNS } from '@app/contracts';
import { ProfileConfigService } from '../config/profile.config.js';
import { ProfileService } from '../profile/profile.service.js';

export const QUEUE_PAYMENT_EVENTS = 'profile-service.payment-events';
export const TOPIC_EXCHANGE = 'platform.events';
export const DLX_EXCHANGE = 'platform.events.dlx';
export const ROUTING_KEY_PAYMENT_SUCCEEDED = EVENT_PATTERNS.PAYMENT_SUCCEEDED || 'payment.succeeded';

@Injectable()
export class PaymentEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentEventConsumerService.name);
  private connection: AmqpConnectionManager | null = null;
  private channelWrapper: ChannelWrapper | null = null;

  constructor(
    private readonly config: ProfileConfigService,
    @Inject(forwardRef(() => ProfileService))
    private readonly profileService: ProfileService,
  ) {}

  async onModuleInit() {
    this.startConsumer(this.config.rabbitmqUrl);
  }

  async onModuleDestroy() {
    await this.stopConsumer();
  }

  startConsumer(url: string) {
    try {
      this.connection = amqp.connect([url], {
        heartbeatIntervalInSeconds: 10,
        reconnectTimeInSeconds: 5,
      });

      this.connection.on('connect', () => {
        this.logger.log('Connected to RabbitMQ for payment event consumption');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`Disconnected from RabbitMQ: ${err?.err?.message || 'Connection lost'}`);
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: any) => {
          await channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });
          await channel.assertExchange(TOPIC_EXCHANGE, 'topic', { durable: true });

          await channel.assertQueue(QUEUE_PAYMENT_EVENTS, {
            durable: true,
            deadLetterExchange: DLX_EXCHANGE,
          });

          await channel.bindQueue(QUEUE_PAYMENT_EVENTS, TOPIC_EXCHANGE, ROUTING_KEY_PAYMENT_SUCCEEDED);

          await channel.consume(QUEUE_PAYMENT_EVENTS, async (msg: any) => {
            if (!msg) return;

            try {
              const content = JSON.parse(msg.content.toString()) as EventEnvelope<PaymentSucceededPayload>;
              this.logger.log(
                `Received payment event [${content.type}] for user [${content.data?.userId}] workshop [${content.data?.workshopSlug}] (order: ${content.data?.orderId})`,
              );

              if (content.data?.userId && content.data?.workshopSlug) {
                await this.profileService.handlePaymentSucceeded(content.data);
              }

              channel.ack(msg);
            } catch (err: any) {
              this.logger.error(`Error processing payment event: ${err.message}`);
              channel.nack(msg, false, false);
            }
          });

          this.logger.log(`Initialized consumer on queue [${QUEUE_PAYMENT_EVENTS}] bound to [${ROUTING_KEY_PAYMENT_SUCCEEDED}]`);
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not start payment event consumer: ${err.message}`);
    }
  }

  async stopConsumer() {
    try {
      if (this.channelWrapper) await this.channelWrapper.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignored during shutdown
    }
  }
}
