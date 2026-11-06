import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface UpsertStarterTemplateDto {
  workshopSlug: string;
  language: string;
  version?: string;
  checksum: string;
  fileSize: number;
  s3Key: string;
}

@Injectable()
export class StarterRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Save or update starter template metadata in starter schema
   */
  async upsertStarterTemplate(data: UpsertStarterTemplateDto) {
    const version = data.version || '1.0.0';
    return this.prisma.starterTemplate.upsert({
      where: {
        workshopSlug_language_version: {
          workshopSlug: data.workshopSlug,
          language: data.language,
          version,
        },
      },
      update: {
        checksum: data.checksum,
        fileSize: data.fileSize,
        s3Key: data.s3Key,
      },
      create: {
        workshopSlug: data.workshopSlug,
        language: data.language,
        version,
        checksum: data.checksum,
        fileSize: data.fileSize,
        s3Key: data.s3Key,
      },
    });
  }

  /**
   * Find starter template metadata by workshop slug and language
   */
  async findStarterTemplate(workshopSlug: string, language: string, version: string = '1.0.0') {
    return this.prisma.starterTemplate.findUnique({
      where: {
        workshopSlug_language_version: {
          workshopSlug,
          language,
          version,
        },
      },
    });
  }
}
