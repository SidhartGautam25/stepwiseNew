import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEnrollment(userId: string, workshopSlug: string, language: string) {
    return this.prisma.enrollment.findUnique({
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
  }

  async findUserEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
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
