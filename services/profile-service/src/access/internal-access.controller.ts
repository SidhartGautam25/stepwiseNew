import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Public } from '@app/auth';
import type { AccessCheckV1 } from '@app/contracts';
import { InternalAuthGuard } from '../internal/internal-auth.guard.js';
import { EnrollmentService } from '../enrollment/enrollment.service.js';

@Controller('internal/access')
@Public()
@UseGuards(InternalAuthGuard)
export class InternalAccessController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  /**
   * Internal machine-to-machine access check for catalog-service gating.
   * Returns whether user is enrolled and which chapters/steps are unlocked.
   */
  @Get('users/:userId/workshops/:workshopSlug')
  async checkAccess(
    @Param('userId') userId: string,
    @Param('workshopSlug') workshopSlug: string,
  ): Promise<AccessCheckV1> {
    return this.enrollmentService.checkAccess(userId, workshopSlug);
  }

  /**
   * Internal machine-to-machine enrollment trigger (e.g. from payment-service)
   */
  @Post('users/:userId/workshops/:workshopSlug/enroll')
  async internalEnroll(
    @Param('userId') userId: string,
    @Param('workshopSlug') workshopSlug: string,
    @Body('language') language?: string,
  ) {
    return this.enrollmentService.enroll(userId, workshopSlug, language || 'typescript');
  }
}
