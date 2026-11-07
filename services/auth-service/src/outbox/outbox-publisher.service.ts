import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service.js';
import type { EventEnvelope } from '@app/contracts';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private pollingTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private pollIntervalMs = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqPublisher: RabbitMqPublisherService,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  startPolling(intervalMs: number = 500) {
    this.pollIntervalMs = intervalMs;
    this.pollingTimer = setInterval(() => {
      this.processOutboxBatch().catch((err) => {
        this.logger.error(`Unhandled error during outbox batch processing: ${err.message}`);
      });
    }, this.pollIntervalMs);
    this.logger.log(`Started transactional outbox publisher polling (interval: ${this.pollIntervalMs}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.logger.log('Stopped transactional outbox publisher polling');
    }
  }

  /**
   * Processes a single batch of unpublished outbox events.
   * Can be called directly by background timer or triggered manually in integration tests.
   */
  async processOutboxBatch(): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }

    this.isProcessing = true;
    let publishedCount = 0;

    try {
      // Find unpublished events with retry limit
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: {
          publishedAt: null,
          attempts: { lt: 10 },
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });

      if (pendingEvents.length === 0) {
        return 0;
      }

      for (const event of pendingEvents) {
        const payload = event.payloadJson as any;

        const envelope: EventEnvelope<any> = {
          eventId: event.id,
          type: event.type,
          version: payload?.version || 'v1',
          occurredAt: payload?.occurredAt || event.createdAt.toISOString(),
          correlationId: payload?.correlationId || payload?.eventId || event.id,
          data: payload?.data || payload,
        };

        try {
          // Publish to RabbitMQ exchange with publisher confirm
          await this.rabbitmqPublisher.publishEvent(event.type, envelope);

          // Update outbox state to published
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              publishedAt: new Date(),
            },
          });

          publishedCount++;
          this.logger.log(`Successfully published outbox event [${event.type}] (id: ${event.id})`);
        } catch (pubErr: any) {
          this.logger.warn(
            `Failed to publish outbox event (id: ${event.id}, attempt ${event.attempts + 1}): ${pubErr.message}`,
          );

          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts: { increment: 1 },
            },
          });
        }
      }
    } catch (err: any) {
      // Database offline/unreachable in unit tests or transient connection error
      this.logger.debug(`Outbox polling iteration skipped: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }

    return publishedCount;
  }
}
