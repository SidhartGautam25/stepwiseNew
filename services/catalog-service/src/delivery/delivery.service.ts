import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedUser, StarterDownloadUrlV1 } from '@app/contracts';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CachedAccessPolicyService } from '../access/cached-access-policy.service.js';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly accessPolicy: CachedAccessPolicyService,
  ) {}

  async getStarterDownloadUrl(
    slug: string,
    language?: string,
    user?: AuthenticatedUser,
  ): Promise<StarterDownloadUrlV1> {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!language) {
      throw new BadRequestException('Language query parameter is required (e.g. ?language=go)');
    }

    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: { versions: true },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    // Check access with profile-service (fail-closed if down)
    const access = await this.accessPolicy.checkAccess(user.id, slug);

    if (!access.enrolled) {
      throw new ForbiddenException(`You must be enrolled in "${slug}" to download starter repositories`);
    }

    const targetVersionId = access.versionId || workshop.latestPublishedId;
    if (!targetVersionId) {
      throw new NotFoundException(`No published version found for workshop "${slug}"`);
    }

    const versionRow = workshop.versions.find((v) => v.id === targetVersionId);
    if (!versionRow) {
      throw new NotFoundException(`Version "${targetVersionId}" not found for "${slug}"`);
    }

    const artifact = await this.prisma.artifact.findFirst({
      where: {
        versionId: targetVersionId,
        kind: 'starter_zip',
        language: language.toLowerCase(),
      },
    });

    if (!artifact) {
      throw new NotFoundException(
        `Starter zip not available for language "${language}" in version "${versionRow.version}"`,
      );
    }

    const filename = `${slug}-${language}-starter.zip`;
    const signedUrl = await this.storage.getSignedDownloadUrl(
      artifact.storageKey,
      300,
      filename,
    );

    return {
      url: signedUrl,
      filename,
      language: language.toLowerCase(),
      version: versionRow.version,
      expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
    };
  }
}
