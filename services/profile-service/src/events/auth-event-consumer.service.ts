import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ProfileService } from '../profile/profile.service.js';
import type { EventEnvelope, UserRegisteredV1 } from '@app/contracts';

export const QUEUE_AUTH_EVENTS = 'profile-service.auth-events';
export const TOPIC_EXCHANGE = 'platform.events';
export const DLX_EXCHANGE = 'platform.events.dlx';
export const ROUTING_KEY_USER_REGISTERED = 'auth.user.registered';

@Injectable()
export class AuthEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEventConsumerService.name);
  private connection: AmqpConnectionManager | null = null;
  private channelWrapper: ChannelWrapper | null = null;

  constructor(private readonly profileService: ProfileService) {}

  async onModuleInit() {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://handrail:handrail_password@localhost:5672';
    this.startConsumer(rabbitmqUrl);
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
        this.logger.log('Connected to RabbitMQ for event consumption');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`Disconnected from RabbitMQ: ${err.err?.message || 'Connection lost'}`);
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: any) => {
          // Assert exchanges
          await channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });
          await channel.assertExchange(TOPIC_EXCHANGE, 'topic', { durable: true });

          // Assert durable queue with DLX configuration
          await channel.assertQueue(QUEUE_AUTH_EVENTS, {
            durable: true,
            deadLetterExchange: DLX_EXCHANGE,
          });

          // Bind queue to topic exchange on auth.user.registered
          await channel.bindQueue(QUEUE_AUTH_EVENTS, TOPIC_EXCHANGE, ROUTING_KEY_USER_REGISTERED);

          // Consume messages
          await channel.consume(QUEUE_AUTH_EVENTS, async (msg: any) => {
            if (!msg) return;

            try {
              const content = JSON.parse(msg.content.toString()) as EventEnvelope<UserRegisteredV1>;
              this.logger.log(
                `Received event [${content.type}] (id: ${content.eventId}) for user ${content.data?.userId}`,
              );

              if (content.type === ROUTING_KEY_USER_REGISTERED && content.data) {
                await this.profileService.handleUserRegisteredEvent(content.data);
              }

              channel.ack(msg);
            } catch (err: any) {
              this.logger.error(`Error processing auth event: ${err.message}`);
              // Reject and dead-letter on poison message
              channel.nack(msg, false, false);
            }
          });

          this.logger.log(`Initialized consumer on queue [${QUEUE_AUTH_EVENTS}] bound to [${ROUTING_KEY_USER_REGISTERED}]`);
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not start RabbitMQ event consumer: ${err.message}`);
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
