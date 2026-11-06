import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { PrismaService } from './prisma.service.js';
import type {
  EnrollResponseDto,
  WorkshopProgressResponseDto,
  StepProgressItemDto,
  StepStatus,
} from '@app/contracts';

interface StepSummaryInfo {
  slug: string;
  title: string;
  globalOrder: number;
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Discovers steps for a workshop across 3 fallback tiers:
   * 1. Catalog service HTTP API
   * 2. Catalog schema SQL query in PostgreSQL
   * 3. Local content/ directory parsing
   */
  async getWorkshopSteps(slug: string): Promise<StepSummaryInfo[]> {
    // 1. Try Catalog Service HTTP API
    const catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';
    try {
      const res = await fetch(`${catalogUrl}/v1/workshops/${slug}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        const steps: StepSummaryInfo[] = [];
        if (data.chapters && Array.isArray(data.chapters)) {
          for (const ch of data.chapters) {
            if (ch.steps && Array.isArray(ch.steps)) {
              for (const s of ch.steps) {
                steps.push({
                  slug: s.slug,
                  title: s.title,
                  globalOrder: s.globalOrder,
                });
              }
            }
          }
        }
        if (steps.length > 0) {
          return steps.sort((a, b) => a.globalOrder - b.globalOrder);
        }
      }
    } catch {
      // Fallback to Tier 2
    }

    // 2. Try PostgreSQL catalog schema query
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
      // Fallback to Tier 3
    }

    // 3. Try reading content/ directory directly
    try {
      let contentBase = path.resolve(process.cwd(), 'content');
      if (!fs.existsSync(contentBase)) {
        let cur = process.cwd();
        for (let i = 0; i < 4; i++) {
          const candidate = path.join(cur, 'content');
          if (fs.existsSync(candidate)) {
            contentBase = candidate;
            break;
          }
          cur = path.dirname(cur);
        }
      }
      const contentDir = path.resolve(contentBase, slug);
      if (fs.existsSync(contentDir)) {
        const chaptersDir = path.join(contentDir, 'chapters');
        if (fs.existsSync(chaptersDir)) {
          const steps: StepSummaryInfo[] = [];
          const chapterDirs = fs.readdirSync(chaptersDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);

          for (const ch of chapterDirs) {
            const stepsDir = path.join(chaptersDir, ch, 'steps');
            if (fs.existsSync(stepsDir)) {
              const stepDirs = fs.readdirSync(stepsDir, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);

              for (const st of stepDirs) {
                const stepYamlFile = path.join(stepsDir, st, 'step.yaml');
                if (fs.existsSync(stepYamlFile)) {
                  const parsed = yaml.parse(fs.readFileSync(stepYamlFile, 'utf8'));
                  steps.push({
                    slug: st,
                    title: parsed.title || st,
                    globalOrder: Number(parsed.global_order) || 1,
                  });
                }
              }
            }
          }
          if (steps.length > 0) {
            return steps.sort((a, b) => a.globalOrder - b.globalOrder);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading content directory for ${slug}: ${err.message}`);
    }

    throw new NotFoundException(`Workshop with slug "${slug}" not found or has no steps`);
  }

  /**
   * Enroll a user in a workshop and initialize step progression:
   * First step: AVAILABLE
   * Remaining steps: LOCKED
   */
  async enroll(slug: string, language: string, userId: string): Promise<EnrollResponseDto> {
    const steps = await this.getWorkshopSteps(slug);
    if (!steps || steps.length === 0) {
      throw new NotFoundException(`No steps found for workshop "${slug}"`);
    }

    // Upsert Enrollment record
    let enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_workshopSlug_language: {
          userId,
          workshopSlug: slug,
          language,
        },
      },
    });

    if (!enrollment) {
      enrollment = await this.prisma.enrollment.create({
        data: {
          userId,
          workshopSlug: slug,
          language,
        },
      });
    }

    // Initialize step progresses
    const stepProgressItems: StepProgressItemDto[] = [];
    const firstStepInfo = steps[0];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const initialStatus: StepStatus = i === 0 ? 'AVAILABLE' : 'LOCKED';

      const existingProgress = await this.prisma.stepProgress.findUnique({
        where: {
          enrollmentId_stepSlug: {
            enrollmentId: enrollment.id,
            stepSlug: step.slug,
          },
        },
      });

      let finalStatus: StepStatus = initialStatus;
      let completedAt = null;

      if (existingProgress) {
        // Do not downgrade already completed or available steps
        if (existingProgress.status === 'COMPLETED') {
          finalStatus = 'COMPLETED';
          completedAt = existingProgress.completedAt;
        } else if (existingProgress.status === 'AVAILABLE') {
          finalStatus = 'AVAILABLE';
        }
        stepProgressItems.push({
          id: existingProgress.id,
          stepSlug: step.slug,
          globalOrder: step.globalOrder,
          status: finalStatus,
          completedAt: completedAt ? completedAt.toISOString() : null,
        });
      } else {
        const created = await this.prisma.stepProgress.create({
          data: {
            enrollmentId: enrollment.id,
            stepSlug: step.slug,
            globalOrder: step.globalOrder,
            status: finalStatus,
          },
        });
        stepProgressItems.push({
          id: created.id,
          stepSlug: step.slug,
          globalOrder: step.globalOrder,
          status: finalStatus,
          completedAt: null,
        });
      }
    }

    return {
      enrollmentId: enrollment.id,
      workshopSlug: slug,
      language,
      firstStep: {
        slug: firstStepInfo.slug,
        title: firstStepInfo.title,
        globalOrder: firstStepInfo.globalOrder,
      },
      steps: stepProgressItems,
    };
  }

  /**
   * Get current enrollment and step progress for a user and workshop
   */
  async getWorkshopProgress(slug: string, userId: string): Promise<WorkshopProgressResponseDto> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        workshopSlug: slug,
      },
      include: {
        steps: {
          orderBy: { globalOrder: 'asc' },
        },
      },
    });

    if (!enrollment) {
      return {
        isEnrolled: false,
        enrollmentId: null,
        workshopSlug: slug,
        language: null,
        steps: [],
      };
    }

    return {
      isEnrolled: true,
      enrollmentId: enrollment.id,
      workshopSlug: slug,
      language: enrollment.language,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      steps: enrollment.steps.map((s) => ({
        id: s.id,
        stepSlug: s.stepSlug,
        globalOrder: s.globalOrder,
        status: s.status as StepStatus,
        completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      })),
    };
  }
}
