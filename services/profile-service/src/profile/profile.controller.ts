import { Controller, Inject, Get, Patch, Body } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';

@Controller('v1')
export class ProfileController {
  constructor(
    @Inject(ProfileService)
    private readonly profileService: ProfileService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id, user.email);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { displayName?: string; avatarUrl?: string },
  ) {
    return this.profileService.updateProfile(user.id, body);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getPreferences(user.id, user.email);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      defaultLevel?: string;
      defaultLanguage?: string;
      theme?: string;
    },
  ) {
    return this.profileService.updatePreferences(user.id, body);
  }

  @Get('activity')
  async getActivity(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getActivity(user.id);
  }
}
