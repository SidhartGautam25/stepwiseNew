import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(actor: string, action: string, subject: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actor,
          action,
          subject,
          metadataJson: (metadata as any) ?? undefined,
        },
      });
      this.logger.log(`Audit: [${action}] by [${actor}] on [${subject}]`);
    } catch (err: any) {
      this.logger.error(`Failed to record audit event: ${err.message}`, err.stack);
    }
  }
}
