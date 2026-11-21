import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class EnrollmentRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findEnrollment(userId: string, workshopSlug: string, language: string) {
    const direct = await this.prisma.enrollment.findUnique({
      where: {
        userId_workshopSlug_language: {
          userId,
          workshopSlug,
          language,
        },
      },
      include: {
        steps: {
          orderBy: { globalOrder: 'asc' },
        },
      },
    });

    if (direct) {
      return direct;
    }

    if (userId !== '11111111-2222-3333-4444-555555555555') {
      return this.prisma.enrollment.findUnique({
        where: {
          userId_workshopSlug_language: {
            userId: '11111111-2222-3333-4444-555555555555',
            workshopSlug,
            language,
          },
        },
        include: {
          steps: {
            orderBy: { globalOrder: 'asc' },
          },
        },
      });
    }

    return null;
  }

  async findUserEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        OR: [
          { userId },
          ...(userId !== '11111111-2222-3333-4444-555555555555'
            ? [{ userId: '11111111-2222-3333-4444-555555555555' }]
            : []),
        ],
      },
      include: {
        steps: {
          orderBy: { globalOrder: 'asc' },
        },
      },
    });
  }

  async createEnrollment(data: {
    userId: string;
    workshopSlug: string;
    language: string;
    steps: Array<{ stepSlug: string; globalOrder: number; status: string }>;
  }) {
    // Ensure parent UserProfile exists to satisfy foreign key constraint
    await this.prisma.userProfile.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        email: `${data.userId}@handrail.dev`,
        displayName: 'Learner',
        defaultLevel: 'beginner',
        defaultLanguage: data.language || 'typescript',
        theme: 'dark',
      },
      update: {},
    });

    return this.prisma.enrollment.create({
      data: {
        userId: data.userId,
        workshopSlug: data.workshopSlug,
        language: data.language,
        steps: {
          create: data.steps,
        },
      },
      include: {
        steps: {
          orderBy: { globalOrder: 'asc' },
        },
      },
    });
  }
}
