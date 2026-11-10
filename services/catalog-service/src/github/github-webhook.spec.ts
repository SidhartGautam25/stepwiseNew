import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { GitHubWebhookController } from './github-webhook.controller.js';

describe('GitHubWebhookController', () => {
  let controller: GitHubWebhookController;
  let mockConfig: any;
  let mockPrisma: any;
  let mockQueue: any;

  beforeEach(() => {
    mockConfig = {
      githubWebhookSecret: 'test-webhook-secret-12345',
      redisUrl: 'redis://localhost:6379',
    };
    mockPrisma = {
      workshop: {
        findFirst: vi.fn(),
      },
    };
    mockQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    controller = new GitHubWebhookController(
      mockConfig,
      mockPrisma,
      mockQueue,
    );
  });

  it('rejects missing signature when secret is configured', async () => {
    const req: any = { body: {} };
    await expect(
      controller.handleWebhook(undefined, 'delivery-1', 'push', req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    const rawBody = Buffer.from(JSON.stringify({ test: 123 }));
    const req: any = { body: { test: 123 }, rawBody };
    await expect(
      controller.handleWebhook('sha256=invalid-signature', 'delivery-1', 'push', req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts valid HMAC signature and enqueues ingest on main push', async () => {
    const body = {
      ref: 'refs/heads/main',
      after: 'a1b2c3d4e5f6',
      repository: { full_name: 'handrail/sample-workshop' },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const hmac = `sha256=${crypto
      .createHmac('sha256', mockConfig.githubWebhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    mockPrisma.workshop.findFirst.mockResolvedValue({
      id: 'ws-1',
      slug: 'http-server',
      repoFullName: 'handrail/sample-workshop',
    });

    const req: any = { body, rawBody };
    const res = await controller.handleWebhook(hmac, 'delivery-unique-1', 'push', req);

    expect(res).toEqual({
      status: 'enqueued',
      workshopSlug: 'http-server',
      ref: 'refs/heads/main',
    });
    expect(mockQueue.enqueue).toHaveBeenCalledWith({
      workshopSlug: 'http-server',
      trigger: 'webhook',
      mainSha: 'a1b2c3d4e5f6',
    });
  });

  it('ignores pushes to non-main and non-chapter branches', async () => {
    const body = {
      ref: 'refs/heads/feature/docs-update',
      repository: { full_name: 'handrail/sample-workshop' },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const hmac = `sha256=${crypto
      .createHmac('sha256', mockConfig.githubWebhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    const req: any = { body, rawBody };
    const res = await controller.handleWebhook(hmac, 'delivery-unique-2', 'push', req);

    expect(res).toEqual({
      status: 'ignored',
      reason: 'irrelevant_ref',
      ref: 'refs/heads/feature/docs-update',
    });
    expect(mockQueue.enqueue).not.toHaveBeenCalled();
  });
});
