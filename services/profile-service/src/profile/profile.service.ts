import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ProfileRepository } from './profile.repository.js';
import type { UserRegisteredV1 } from '@app/contracts';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(ProfileRepository)
    private readonly repository: ProfileRepository,
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
