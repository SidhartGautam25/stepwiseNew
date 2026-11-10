import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as semver from 'semver';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from '../common/audit.service.js';
import { EventsPublisherService } from '../common/events.publisher.js';
import { IngestQueueService } from '../ingest/ingest.queue.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly events: EventsPublisherService,
    private readonly queue: IngestQueueService,
  ) {}

  async registerWorkshop(data: {
    slug: string;
    repoFullName: string;
    access?: string;
    installationId?: string;
    actor?: string;
  }) {
    const existing = await this.prisma.workshop.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new ConflictException(`Workshop with slug "${data.slug}" already exists`);
    }

    const workshop = await this.prisma.workshop.create({
      data: {
        slug: data.slug,
        repoFullName: data.repoFullName,
        access: data.access || 'public',
        installationId: data.installationId,
      },
    });

    await this.audit.log(
      data.actor || 'admin',
      'workshop.register',
      data.slug,
      { repoFullName: data.repoFullName },
    );

    // Auto-enqueue initial ingest
    await this.queue.enqueue({
      workshopSlug: workshop.slug,
      trigger: 'manual',
    });

    return workshop;
  }

  async listWorkshops() {
    const workshops = await this.prisma.workshop.findMany({
      include: {
        versions: {
          select: {
            id: true,
            version: true,
            kind: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workshops.map((w) => ({
      id: w.id,
      slug: w.slug,
      repoFullName: w.repoFullName,
      access: w.access,
      status: w.status,
      latestPublishedId: w.latestPublishedId,
      versionsCount: w.versions.length,
      versions: w.versions,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }

  async triggerSync(slug: string, force?: boolean, actor?: string) {
    const workshop = await this.prisma.workshop.findUnique({ where: { slug } });
    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    await this.queue.enqueue({
      workshopSlug: slug,
      trigger: 'manual',
      force: Boolean(force),
    });

    await this.audit.log(actor || 'admin', 'workshop.sync', slug, { force });

    return { status: 'enqueued', workshopSlug: slug };
  }

  async listVersions(slug: string) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        versions: {
          include: {
            _count: {
              select: { chapters: true, artifacts: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    return workshop.versions.map((v) => ({
      id: v.id,
      version: v.version,
      kind: v.kind,
      mainSha: v.mainSha,
      releaseNotesMd: v.releaseNotesMd,
      lintReport: v.lintReportJson,
      chaptersCount: v._count.chapters,
      artifactsCount: v._count.artifacts,
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
    }));
  }

  async publishVersion(
    slug: string,
    versionId: string,
    data: { version: string; releaseNotes?: string },
    actor?: string,
  ) {
    const cleanVersion = semver.clean(data.version);
    if (!cleanVersion || !semver.valid(cleanVersion)) {
      throw new BadRequestException(`Invalid SemVer version string: "${data.version}"`);
    }

    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        versions: true,
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    // Verify draft version
    const draft = workshop.versions.find((v) => v.id === versionId || v.kind === 'draft');
    if (!draft) {
      throw new NotFoundException(`Draft version with ID "${versionId}" not found for workshop "${slug}"`);
    }

    // Check lint report
    const lintReport = draft.lintReportJson as any;
    if (lintReport?.summary?.errors && lintReport.summary.errors > 0) {
      throw new BadRequestException(
        `Cannot publish draft with ${lintReport.summary.errors} lint error(s)`,
      );
    }

    // Check SemVer monotonicity against published versions
    const publishedVersions = workshop.versions.filter((v) => v.kind === 'published');
    const existingPublished = publishedVersions.find((v) => v.version === cleanVersion);
    if (existingPublished) {
      throw new ConflictException(`Version "${cleanVersion}" is already published`);
    }

    if (publishedVersions.length > 0) {
      const sorted = publishedVersions
        .map((v) => v.version)
        .filter((v) => semver.valid(v))
        .sort((a, b) => semver.rcompare(a, b));

      const highestVersion = sorted[0];
      if (highestVersion && semver.lte(cleanVersion, highestVersion)) {
        throw new BadRequestException(
          `New version "${cleanVersion}" must be strictly greater than latest published version "${highestVersion}"`,
        );
      }
    }

    // Copy S3 artifacts from draft to published path
    const artifacts = await this.prisma.artifact.findMany({
      where: { versionId: draft.id },
    });

    const publishedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const art of artifacts) {
        const destKey = art.storageKey.replace('/draft/', `/${cleanVersion}/`);
        await this.storage.copyObject(art.storageKey, destKey);
        await tx.artifact.update({
          where: { id: art.id },
          data: { storageKey: destKey },
        });
      }

      // Freeze draft into published version
      await tx.workshopVersion.update({
        where: { id: draft.id },
        data: {
          version: cleanVersion,
          kind: 'published',
          publishedAt,
          releaseNotesMd: data.releaseNotes || null,
        },
      });

      // Update workshop latestPublishedId
      await tx.workshop.update({
        where: { id: workshop.id },
        data: {
          latestPublishedId: draft.id,
        },
      });
    });

    // Emit catalog.workshop.published event
    await this.events.publish('catalog.workshop.published', {
      workshopSlug: slug,
      version: cleanVersion,
      versionId: draft.id,
      publishedAt: publishedAt.toISOString(),
      actor: actor || 'admin',
    });

    // Record audit event
    await this.audit.log(actor || 'admin', 'workshop.publish', slug, {
      version: cleanVersion,
      versionId: draft.id,
    });

    return {
      status: 'published',
      workshopSlug: slug,
      version: cleanVersion,
      versionId: draft.id,
      publishedAt,
    };
  }

  async deprecateVersion(
    slug: string,
    data: { version: string; reason?: string },
    actor?: string,
  ) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: { versions: true },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    const versionRow = workshop.versions.find((v) => v.version === data.version);
    if (!versionRow) {
      throw new NotFoundException(`Version "${data.version}" not found for workshop "${slug}"`);
    }

    await this.prisma.workshopVersion.update({
      where: { id: versionRow.id },
      data: { kind: 'deprecated' },
    });

    // If deprecated version was latestPublishedId, recalculate to next highest published version
    if (workshop.latestPublishedId === versionRow.id) {
      const remainingPublished = workshop.versions.filter(
        (v) => v.kind === 'published' && v.id !== versionRow.id,
      );

      let nextLatestId: string | null = null;
      if (remainingPublished.length > 0) {
        remainingPublished.sort((a, b) => {
          if (semver.valid(a.version) && semver.valid(b.version)) {
            return semver.rcompare(a.version, b.version);
          }
          return 0;
        });
        nextLatestId = remainingPublished[0].id;
      }

      await this.prisma.workshop.update({
        where: { id: workshop.id },
        data: { latestPublishedId: nextLatestId },
      });
    }

    await this.audit.log(actor || 'admin', 'workshop.deprecate', slug, {
      version: data.version,
      reason: data.reason,
    });

    return {
      status: 'deprecated',
      workshopSlug: slug,
      version: data.version,
    };
  }

  async listAuditEvents(params?: {
    subject?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params?.limit || 50, 100);
    const offset = params?.offset || 0;

    const where: any = {};
    if (params?.subject) where.subject = params.subject;
    if (params?.action) where.action = params.action;

    const [total, events] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      events,
    };
  }
}
