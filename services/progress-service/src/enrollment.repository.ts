import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import type { StepStatus } from '@app/contracts';

export interface CreateStepProgressDto {
  enrollmentId: string;
  stepSlug: string;
  globalOrder: number;
  status: StepStatus;
}

export interface CatalogStepRow {
  slug: string;
  title: string;
  globalOrder: number;
}

@Injectable()
export class EnrollmentRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queries catalog schema tables directly via PostgreSQL query
   */
  async findWorkshopStepsFromCatalog(slug: string): Promise<CatalogStepRow[]> {
    try {
      const rawSteps = await this.prisma.$queryRaw<
        Array<{ slug: string; title: string; global_order: number }>
      >`
        SELECT s.slug, s.title, s.global_order
        FROM catalog.steps s
        JOIN catalog.chapters c ON s.chapter_id = c.id
        JOIN catalog.workshops w ON c.workshop_id = w.id
        WHERE w.slug = ${slug}
        ORDER BY s.global_order ASC
      `;
      if (rawSteps && rawSteps.length > 0) {
        return rawSteps.map((s) => ({
          slug: s.slug,
          title: s.title,
          globalOrder: s.global_order,
        }));
      }
    } catch {
      // Fallback handled by caller
    }
    return [];
  }

  /**
   * Find a specific user enrollment by workshop slug and language
   */
  async findEnrollment(userId: string, workshopSlug: string, language: string) {
    return this.prisma.enrollment.findUnique({
      where: {
        userId_workshopSlug_language: {
          userId,
          workshopSlug,
          language,
        },
      },
    });
  }

  /**
   * Create a new user enrollment record
   */
  async createEnrollment(userId: string, workshopSlug: string, language: string) {
    return this.prisma.enrollment.create({
      data: {
        userId,
        workshopSlug,
        language,
      },
    });
  }

  /**
   * Find enrollment with all ordered step progresses for a user
   */
  async findEnrollmentWithProgress(userId: string, workshopSlug: string) {
    return this.prisma.enrollment.findFirst({
      where: {
        userId,
        workshopSlug,
      },
      include: {
        steps: {
          orderBy: { globalOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Find a specific step progress record within an enrollment
   */
  async findStepProgress(enrollmentId: string, stepSlug: string) {
    return this.prisma.stepProgress.findUnique({
      where: {
        enrollmentId_stepSlug: {
          enrollmentId,
          stepSlug,
        },
      },
    });
  }

  /**
   * Create a step progress record
   */
  async createStepProgress(data: CreateStepProgressDto) {
    return this.prisma.stepProgress.create({
      data: {
        enrollmentId: data.enrollmentId,
        stepSlug: data.stepSlug,
        globalOrder: data.globalOrder,
        status: data.status,
      },
    });
  }

  /**
   * Update an existing step progress status
   */
  async updateStepProgress(id: string, status: StepStatus, completedAt?: Date | null) {
    return this.prisma.stepProgress.update({
      where: { id },
      data: {
        status,
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });
  }
}
