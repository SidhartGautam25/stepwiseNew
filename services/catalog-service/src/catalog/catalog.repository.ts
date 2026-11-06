import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class CatalogRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find all workshops ordered by creation date including languages, chapters, and steps
   */
  async findManyWorkshops() {
    return this.prisma.workshop.findMany({
      include: {
        languages: true,
        chapters: {
          include: {
            steps: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find complete workshop overview by slug with chapters, steps, and tests
   */
  async findWorkshopBySlug(slug: string) {
    return this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        languages: true,
        chapters: {
          orderBy: { orderIndex: 'asc' },
          include: {
            steps: {
              orderBy: { globalOrder: 'asc' },
              include: {
                tests: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find a step with tests and 3-level content bundles within a workshop
   */
  async findStepWithDetails(workshopSlug: string, stepSlug: string) {
    return this.prisma.workshop.findUnique({
      where: { slug: workshopSlug },
      include: {
        chapters: {
          include: {
            steps: {
              where: { slug: stepSlug },
              include: {
                tests: true,
                contents: true,
              },
            },
          },
        },
      },
    });
  }
}
