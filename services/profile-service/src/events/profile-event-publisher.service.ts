import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { randomUUID } from 'crypto';
import type { EventEnvelope, EnrollmentCreatedPayload } from '@app/contracts';
import { EVENT_PATTERNS } from '@app/contracts';
import { ProfileConfigService } from '../config/profile.config.js';

export const PLATFORM_EVENTS_EXCHANGE = 'platform.events';

@Injectable()
export class ProfileEventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProfileEventPublisherService.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(private readonly config: ProfileConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = amqp.connect([this.config.rabbitmqUrl], {
        heartbeatIntervalInSeconds: 10,
        reconnectTimeInSeconds: 5,
      });

      this.connection.on('connect', () => {
        this.logger.log('ProfileEventPublisher connected to RabbitMQ');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`ProfileEventPublisher disconnected: ${err?.err?.message || 'unknown'}`);
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: Channel) => {
          await channel.assertExchange(PLATFORM_EVENTS_EXCHANGE, 'topic', { durable: true });
        },
      });

      await this.channelWrapper.waitForConnect();
    } catch (err: any) {
      this.logger.warn(`RabbitMQ publisher initialization deferred: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channelWrapper?.close();
      await this.connection?.close();
    } catch {
      // Ignored during shutdown
    }
  }

  async publishEnrollmentCreated(payload: EnrollmentCreatedPayload, correlationId?: string): Promise<boolean> {
    const envelope: EventEnvelope<EnrollmentCreatedPayload> = {
      eventId: randomUUID(),
      type: EVENT_PATTERNS.ENROLLMENT_CREATED || 'profile.enrollment.created',
      version: '1.0.0',
      occurredAt: new Date().toISOString(),
      correlationId: correlationId || randomUUID(),
      data: payload,
    };

    if (!this.channelWrapper) {
      this.logger.warn(
        `RabbitMQ not connected, skipping publish [profile.enrollment.created] for user [${payload.userId}]`,
      );
      return false;
    }

    try {
      await this.channelWrapper.publish(
        PLATFORM_EVENTS_EXCHANGE,
        'profile.enrollment.created',
        envelope,
        { persistent: true, contentType: 'application/json' },
      );
      this.logger.log(
        `Published [profile.enrollment.created] event for user [${payload.userId}] workshop [${payload.workshopSlug}]`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to publish [profile.enrollment.created]: ${err.message}`);
      return false;
    }
  }
}
