import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CatalogConfigService } from '../config/catalog.config.js';
import { IngestService } from './ingest.service.js';
import type { IngestJob } from './ingest-job.interface.js';

export const INGEST_QUEUE = 'catalog.ingest.jobs';
export const INGEST_EXCHANGE = 'catalog.ingest.exchange';
export const INGEST_DLX = 'catalog.ingest.dlx';
export const INGEST_DLQ = 'catalog.ingest.dlq';

@Injectable()
export class IngestQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestQueueService.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(
    private readonly config: CatalogConfigService,
    private readonly ingestService: IngestService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = amqp.connect([this.config.rabbitmqUrl]);
      this.connection.on('connect', () => this.logger.log('IngestQueue connected to RabbitMQ.'));
      this.connection.on('disconnect', (err) =>
        this.logger.warn(`IngestQueue disconnected from RabbitMQ: ${err?.err?.message || 'unknown'}`),
      );

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: Channel) => {
          // Assert Dead Letter exchange and queue
          await channel.assertExchange(INGEST_DLX, 'direct', { durable: true });
          await channel.assertQueue(INGEST_DLQ, { durable: true });
          await channel.bindQueue(INGEST_DLQ, INGEST_DLX, 'dead-letter');

          // Assert main exchange and queue with DLX
          await channel.assertExchange(INGEST_EXCHANGE, 'direct', { durable: true });
          await channel.assertQueue(INGEST_QUEUE, {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': INGEST_DLX,
              'x-dead-letter-routing-key': 'dead-letter',
            },
          });
          await channel.bindQueue(INGEST_QUEUE, INGEST_EXCHANGE, 'ingest');

          // Strict prefetch: 1 job at a time per worker
          await channel.prefetch(1);

          // Consume messages
          await channel.consume(
            INGEST_QUEUE,
            async (msg: ConsumeMessage | null) => {
              if (!msg) return;
              try {
                const job: IngestJob = JSON.parse(msg.content.toString('utf-8'));
                this.logger.log(`Received ingest job: ${JSON.stringify(job)}`);

                const result = await this.ingestService.processJob(job);
                if (result.success) {
                  channel.ack(msg);
                } else {
                  this.logger.error(`Ingest job failed: ${result.error}. Rejecting to DLQ.`);
                  channel.nack(msg, false, false);
                }
              } catch (err: any) {
                this.logger.error(`Error processing ingest queue message: ${err.message}`, err.stack);
                channel.nack(msg, false, false);
              }
            },
            { noAck: false },
          );
        },
      });

      await this.channelWrapper.waitForConnect();
    } catch (err: any) {
      this.logger.warn(`RabbitMQ ingest queue init warning: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  async enqueue(job: IngestJob): Promise<void> {
    if (!this.channelWrapper) {
      this.logger.warn('RabbitMQ channel wrapper not initialized. Processing job synchronously in fallback mode.');
      await this.ingestService.processJob(job);
      return;
    }

    try {
      await this.channelWrapper.publish(
        INGEST_EXCHANGE,
        'ingest',
        job,
        { contentType: 'application/json', persistent: true },
      );
      this.logger.log(`Ingest job enqueued for workshop: ${job.workshopSlug}`);
    } catch (err: any) {
      this.logger.warn(`Failed to enqueue RabbitMQ job (${err.message}). Processing synchronously.`);
      await this.ingestService.processJob(job);
    }
  }
}
