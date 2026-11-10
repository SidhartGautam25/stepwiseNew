import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import * as crypto from 'node:crypto';
import Redis from 'ioredis';
import { Public } from '@app/auth';
import { CatalogConfigService } from '../config/catalog.config.js';
import { PrismaService } from '../prisma.service.js';
import { IngestQueueService } from '../ingest/ingest.queue.js';

@Controller('v1/github')
export class GitHubWebhookController {
  private readonly logger = new Logger(GitHubWebhookController.name);
  private readonly redis: Redis;

  constructor(
    private readonly config: CatalogConfigService,
    private readonly prisma: PrismaService,
    private readonly queue: IngestQueueService,
  ) {
    this.redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  @Public()
  @Post('content-webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Req() req: Request,
  ) {
    // 1. Signature verification
    const secret = this.config.githubWebhookSecret;
    if (secret) {
      if (!signature) {
        throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
      }

      // Raw body buffer
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedHmac = `sha256=${crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex')}`;

      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedHmac);

      if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
      ) {
        this.logger.warn('GitHub webhook signature mismatch');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // 2. Delivery deduplication
    if (deliveryId) {
      try {
        if (this.redis.status !== 'ready') {
          await this.redis.connect().catch(() => {});
        }
        const isNew = await this.redis.set(`github:delivery:${deliveryId}`, '1', 'EX', 86400, 'NX');
        if (!isNew) {
          this.logger.log(`Ignoring duplicate delivery: ${deliveryId}`);
          return { status: 'ignored', reason: 'duplicate_delivery' };
        }
      } catch (err: any) {
        this.logger.warn(`Redis deduplication warning: ${err.message}`);
      }
    }

    // 3. Handle push event
    if (event === 'push') {
      const body = req.body;
      const ref = body?.ref as string | undefined;
      const repoFullName = body?.repository?.full_name as string | undefined;

      if (!repoFullName) {
        return { status: 'ignored', reason: 'missing_repository' };
      }

      // Only trigger ingest on main or chapter branches
      const isMain = ref === 'refs/heads/main';
      const isChapter = ref?.startsWith('refs/heads/chapter/');

      if (!isMain && !isChapter) {
        return { status: 'ignored', reason: 'irrelevant_ref', ref };
      }

      const workshop = await this.prisma.workshop.findFirst({
        where: { repoFullName },
      });

      if (!workshop) {
        this.logger.warn(`No registered workshop found for repo: ${repoFullName}`);
        return { status: 'ignored', reason: 'workshop_not_found', repoFullName };
      }

      await this.queue.enqueue({
        workshopSlug: workshop.slug,
        trigger: 'webhook',
        mainSha: isMain ? body?.after : undefined,
      });

      return {
        status: 'enqueued',
        workshopSlug: workshop.slug,
        ref,
      };
    }

    return { status: 'ignored', event };
  }
}
