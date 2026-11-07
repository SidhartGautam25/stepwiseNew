import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { RabbitMqPublisherService, PLATFORM_EVENTS_EXCHANGE, PLATFORM_EVENTS_DLX } from './rabbitmq-publisher.service.js';

describe('Transactional Outbox Publisher Worker', () => {
  let outboxService: OutboxPublisherService;
  let mockPrisma: any;
  let mockRabbitPublisher: any;

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    mockRabbitPublisher = {
      publishEvent: vi.fn(),
      connected: true,
    };

    outboxService = new OutboxPublisherService(mockPrisma, mockRabbitPublisher);
  });

  it('processes pending outbox events, dispatches to RabbitMQ with confirms, and marks them published', async () => {
    const mockPendingEvents = [
      {
        id: 'event-uuid-1',
        type: 'auth.user.registered',
        createdAt: new Date('2026-03-01T12:00:00Z'),
        attempts: 0,
        publishedAt: null,
        payloadJson: {
          eventId: 'event-uuid-1',
          version: 'v1',
          occurredAt: '2026-03-01T12:00:00Z',
          data: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            email: 'newlearner@handrail.dev',
            roles: ['learner'],
          },
        },
      },
    ];

    mockPrisma.outboxEvent.findMany.mockResolvedValue(mockPendingEvents);
    mockRabbitPublisher.publishEvent.mockResolvedValue(true);
    mockPrisma.outboxEvent.update.mockResolvedValue({});

    const publishedCount = await outboxService.processOutboxBatch();

    expect(publishedCount).toBe(1);

    // Verify event dispatched to RabbitMQ with standard envelope
    expect(mockRabbitPublisher.publishEvent).toHaveBeenCalledWith(
      'auth.user.registered',
      expect.objectContaining({
        eventId: 'event-uuid-1',
        type: 'auth.user.registered',
        version: 'v1',
        data: expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'newlearner@handrail.dev',
        }),
      }),
    );

    // Verify outbox state updated with published timestamp
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-uuid-1' },
        data: expect.objectContaining({
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('increments attempts counter and leaves publishedAt null when broker publication fails', async () => {
    const mockPendingEvents = [
      {
        id: 'event-failed-1',
        type: 'auth.user.registered',
        createdAt: new Date('2026-03-01T12:00:00Z'),
        attempts: 2,
        publishedAt: null,
        payloadJson: {
          data: { userId: '123' },
        },
      },
    ];

    mockPrisma.outboxEvent.findMany.mockResolvedValue(mockPendingEvents);
    mockRabbitPublisher.publishEvent.mockRejectedValue(new Error('Broker channel closed'));
    mockPrisma.outboxEvent.update.mockResolvedValue({});

    const publishedCount = await outboxService.processOutboxBatch();

    expect(publishedCount).toBe(0);

    // Verify attempts incremented
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-failed-1' },
        data: {
          attempts: { increment: 1 },
        },
      }),
    );
  });

  it('skips processing when no events are pending in the outbox table', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const publishedCount = await outboxService.processOutboxBatch();

    expect(publishedCount).toBe(0);
    expect(mockRabbitPublisher.publishEvent).not.toHaveBeenCalled();
    expect(mockPrisma.outboxEvent.update).not.toHaveBeenCalled();
  });
});

describe('RabbitMQ Publisher Topology Configuration', () => {
  it('defines standard durable topic exchange and DLX constants', () => {
    expect(PLATFORM_EVENTS_EXCHANGE).toBe('platform.events');
    expect(PLATFORM_EVENTS_DLX).toBe('platform.events.dlx');
  });
});
