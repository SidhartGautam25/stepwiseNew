import { Injectable, Inject, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { ProfileRepository } from './profile.repository.js';
import { EnrollmentService } from '../enrollment/enrollment.service.js';
import { ProfileEventPublisherService } from '../events/profile-event-publisher.service.js';
import type { UserRegisteredV1, PaymentSucceededPayload } from '@app/contracts';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(ProfileRepository)
    private readonly repository: ProfileRepository,
    @Inject(forwardRef(() => EnrollmentService))
    private readonly enrollmentService: EnrollmentService,
    @Inject(forwardRef(() => ProfileEventPublisherService))
    private readonly eventPublisher: ProfileEventPublisherService,
  ) {}

  /**
   * Returns user profile.
   * If profile does not yet exist (e.g. async event pending or first visit),
   * provides JIT (Just-In-Time) lazy profile provisioning.
   */
  async getProfile(userId: string, fallbackEmail: string = '') {
    let profile: any = await this.repository.findById(userId);

    if (!profile) {
      this.logger.log(`Profile for user [${userId}] not found. Executing JIT lazy provisioning...`);
      profile = await this.repository.upsert(userId, {
        userId,
        email: fallbackEmail,
        displayName: fallbackEmail ? fallbackEmail.split('@')[0] : 'Learner',
        defaultLevel: 'beginner',
        defaultLanguage: 'typescript',
        theme: 'dark',
      });
      await this.repository.recordActivity(userId, 'JIT_PROFILE_INITIALIZED', {
        reason: 'first_request_fallback',
      });
    }

    return profile;
  }

  /**
   * Idempotently provisions a profile from an asynchronous auth.user.registered event.
   */
  async handleUserRegisteredEvent(eventData: UserRegisteredV1) {
    this.logger.log(`Handling asynchronous auth.user.registered event for user [${eventData.userId}]`);

    const profile = await this.repository.upsert(eventData.userId, {
      userId: eventData.userId,
      email: eventData.email,
      displayName: eventData.displayName || eventData.email.split('@')[0],
      defaultLevel: 'beginner',
      defaultLanguage: 'typescript',
      theme: 'dark',
    });

    await this.repository.recordActivity(eventData.userId, 'ACCOUNT_REGISTERED', {
      provider: eventData.provider,
    });

    return profile;
  }

  /**
   * Handles asynchronous payment.succeeded event:
   * JIT provisions user if needed, records activity, creates enrollment, and publishes profile.enrollment.created
   */
  async handlePaymentSucceeded(eventData: PaymentSucceededPayload) {
    this.logger.log(
      `Handling payment.succeeded event for user [${eventData.userId}] workshop [${eventData.workshopSlug}] order [${eventData.orderId}]`,
    );

    const profile = await this.getProfile(eventData.userId);
    const chosenLanguage = profile.defaultLanguage || 'typescript';

    await this.repository.recordActivity(eventData.userId, 'WORKSHOP_PURCHASED', {
      orderId: eventData.orderId,
      paymentId: eventData.paymentId,
      amount: eventData.amount,
      currency: eventData.currency,
      workshopSlug: eventData.workshopSlug,
      paidAt: eventData.paidAt,
    });

    const enrollment = await this.enrollmentService.enroll(
      eventData.userId,
      eventData.workshopSlug,
      chosenLanguage,
    );

    await this.eventPublisher.publishEnrollmentCreated({
      userId: eventData.userId,
      workshopSlug: eventData.workshopSlug,
      language: chosenLanguage,
      enrolledAt: eventData.paidAt || new Date().toISOString(),
    });

    return enrollment;
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    return this.repository.update(userId, {
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    });
  }

  async getPreferences(userId: string, fallbackEmail: string = '') {
    const profile = await this.getProfile(userId, fallbackEmail);
    if (!profile) {
      throw new NotFoundException('Profile could not be found or initialized');
    }
    return {
      defaultLevel: profile.defaultLevel,
      defaultLanguage: profile.defaultLanguage,
      theme: profile.theme,
    };
  }

  async updatePreferences(
    userId: string,
    preferences: {
      defaultLevel?: string;
      defaultLanguage?: string;
      theme?: string;
    },
  ) {
    return this.repository.update(userId, preferences);
  }

  async getActivity(userId: string) {
    return this.repository.getActivities(userId);
  }
}
