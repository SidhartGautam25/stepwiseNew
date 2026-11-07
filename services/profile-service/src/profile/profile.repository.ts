import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

export interface CreateProfileData {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  defaultLevel?: string;
  defaultLanguage?: string;
  theme?: string;
}

@Injectable()
export class ProfileRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findById(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        enrollments: {
          include: {
            steps: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.userProfile.findFirst({
      where: { email },
    });
  }

  async upsert(userId: string, data: CreateProfileData) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        email: data.email,
        displayName: data.displayName || data.email.split('@')[0],
        avatarUrl: data.avatarUrl,
        defaultLevel: data.defaultLevel || 'beginner',
        defaultLanguage: data.defaultLanguage || 'typescript',
        theme: data.theme || 'dark',
      },
      update: {
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      },
    });
  }

  async update(userId: string, data: Partial<CreateProfileData>) {
    return this.prisma.userProfile.update({
      where: { userId },
      data,
    });
  }

  async recordActivity(userId: string, type: string, metadata?: any) {
    return this.prisma.userActivity.create({
      data: {
        userId,
        type,
        metadataJson: metadata || undefined,
      },
    });
  }

  async getActivities(userId: string, limit: number = 20) {
    return this.prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
