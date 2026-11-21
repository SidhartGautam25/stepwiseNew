import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import type { AccessCheckV1 } from '@app/contracts';
import { EnrollmentRepository } from './enrollment.repository.js';
import { ProfileConfigService } from '../config/profile.config.js';
import { ProfileEventPublisherService } from '../events/profile-event-publisher.service.js';

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @Inject(EnrollmentRepository)
    private readonly repository: EnrollmentRepository,
    @Inject(forwardRef(() => ProfileConfigService))
    private readonly config: ProfileConfigService,
    @Inject(forwardRef(() => ProfileEventPublisherService))
    private readonly eventPublisher: ProfileEventPublisherService,
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

  /**
   * Internal machine-to-machine access check for catalog-service gating.
   * If not enrolled in DB, queries payment-service as fallback self-healing mechanism.
   */
  async checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckV1> {
    const enrollments = await this.repository.findUserEnrollments(userId);
    const enrollment = enrollments.find((e) => e.workshopSlug === workshopSlug);

    if (enrollment) {
      const unlockedChapters = enrollment.steps
        .filter((s: any) => s.status !== 'LOCKED')
        .map((s: any) => s.stepSlug);

      const currentStep =
        enrollment.steps.find((s: any) => s.status === 'AVAILABLE' || s.status === 'IN_PROGRESS') ||
        enrollment.steps[0];

      return {
        enrolled: true,
        unlockedChapters: unlockedChapters.length > 0 ? unlockedChapters : ['step-1'],
        currentChapterId: currentStep?.stepSlug || 'step-1',
      };
    }

    // Fallback: Check if payment-service has a completed purchase for this workshop
    const hasPaid = await this.checkUserOwnsWorkshop(userId, workshopSlug);
    if (hasPaid) {
      this.logger.log(
        `Self-healing: Found paid order in payment-service for user [${userId}] workshop [${workshopSlug}]. Auto-enrolling...`,
      );
      await this.enroll(userId, workshopSlug, 'typescript');
      await this.eventPublisher.publishEnrollmentCreated({
        userId,
        workshopSlug,
        language: 'typescript',
        enrolledAt: new Date().toISOString(),
      });

      return {
        enrolled: true,
        unlockedChapters: ['step-1'],
        currentChapterId: 'step-1',
      };
    }

    return {
      enrolled: false,
      unlockedChapters: [],
    };
  }

  /**
   * Verifies with payment-service whether user owns/paid for a workshop
   */
  async checkUserOwnsWorkshop(userId: string, workshopSlug: string): Promise<boolean> {
    const url = `${this.config.paymentServiceUrl}/internal/payments/users/${encodeURIComponent(userId)}/workshops/${encodeURIComponent(workshopSlug)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        headers: {
          'x-service-token': this.config.serviceSecret,
          Authorization: `Bearer ${this.config.serviceSecret}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        return false;
      }

      const data = (await res.json()) as { hasAccess: boolean };
      return Boolean(data.hasAccess);
    } catch (err: any) {
      this.logger.warn(`Could not reach payment-service to verify purchase status: ${err.message}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
