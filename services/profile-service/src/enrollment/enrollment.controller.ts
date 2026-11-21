import { Controller, Inject, Post, Get, Param, Body, Query, ForbiddenException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service.js';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';

@Controller('v1')
export class EnrollmentController {
  constructor(
    @Inject(EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('workshops/:slug/enroll')
  async enroll(
    @Param('slug') workshopSlug: string,
    @Body('language') language: string = 'typescript',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // If user is already enrolled, return existing enrollment
    const existing = await this.enrollmentService.getProgress(user.id, workshopSlug, language);
    if (existing) {
      return existing;
    }

    // Check with payment-service whether user owns/purchased the workshop
    const ownsWorkshop = await this.enrollmentService.checkUserOwnsWorkshop(user.id, workshopSlug);
    if (!ownsWorkshop) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Workshop '${workshopSlug}' requires payment before enrollment. Please complete checkout first.`,
        code: 'PAYMENT_REQUIRED',
        workshopSlug,
      });
    }

    return this.enrollmentService.enroll(user.id, workshopSlug, language);
  }

  @Get('workshops/:slug/progress')
  async getWorkshopProgress(
    @Param('slug') workshopSlug: string,
    @Query('language') language: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentService.getProgress(user.id, workshopSlug, language);
  }

  @Get('progress')
  async getAllProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentService.getAllProgress(user.id);
  }
}
