import { Injectable, Inject, Logger } from '@nestjs/common';
import { EnrollmentRepository } from './enrollment.repository.js';

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @Inject(EnrollmentRepository)
    private readonly repository: EnrollmentRepository,
  ) {}

  async enroll(userId: string, workshopSlug: string, language: string) {
    const existing = await this.repository.findEnrollment(userId, workshopSlug, language);
    if (existing) {
      return existing;
    }

    // Default 5 steps template for new enrollment
    const initialSteps = [
      { stepSlug: 'step-1', globalOrder: 1, status: 'AVAILABLE' },
      { stepSlug: 'step-2', globalOrder: 2, status: 'LOCKED' },
      { stepSlug: 'step-3', globalOrder: 3, status: 'LOCKED' },
      { stepSlug: 'step-4', globalOrder: 4, status: 'LOCKED' },
      { stepSlug: 'step-5', globalOrder: 5, status: 'LOCKED' },
    ];

    const enrollment = await this.repository.createEnrollment({
      userId,
      workshopSlug,
      language,
      steps: initialSteps,
    });

    this.logger.log(`Enrolled user [${userId}] in workshop [${workshopSlug}] with language [${language}]`);
    return enrollment;
  }

  async getProgress(userId: string, workshopSlug: string, language?: string) {
    if (language) {
      return this.repository.findEnrollment(userId, workshopSlug, language);
    }
    const enrollments = await this.repository.findUserEnrollments(userId);
    return enrollments.find((e) => e.workshopSlug === workshopSlug) || null;
  }

  async getAllProgress(userId: string) {
    return this.repository.findUserEnrollments(userId);
  }
}
