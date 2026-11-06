import { Body, Controller, Get, Param, Post, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@app/auth';
import type { UserDto } from '@app/contracts';
import { EnrollDto } from './dto/enroll.dto.js';
import { EnrollmentService } from './enrollment.service.js';

@ApiTags('Enrollment & Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  private extractUserId(req: any, user?: UserDto | null, headers?: any): string {
    return (
      user?.id ||
      req?.user?.id ||
      req?.user?.sub ||
      headers?.['x-user-id'] ||
      'anonymous-user'
    );
  }

  @Post(['workshops/:slug/enroll', 'v1/workshops/:slug/enroll', ':slug/enroll'])
  @ApiOperation({ summary: 'Enroll learner in a workshop and initialize step progression' })
  @ApiResponse({ status: 201, description: 'Enrollment successful; first step unlocked' })
  @ApiResponse({ status: 404, description: 'Workshop not found' })
  async enroll(
    @Param('slug') slug: string,
    @Body() dto: EnrollDto,
    @Request() req: any,
    @CurrentUser() user: UserDto | null,
    @Headers() headers: Record<string, string>,
  ) {
    const userId = this.extractUserId(req, user, headers);
    return this.enrollmentService.enroll(slug, dto.language, userId);
  }

  @Get(['workshops/:slug/progress', 'v1/workshops/:slug/progress', ':slug/progress'])
  @ApiOperation({ summary: 'Get current enrollment and step status for learner' })
  @ApiResponse({ status: 200, description: 'Workshop progress state' })
  async getProgress(
    @Param('slug') slug: string,
    @Request() req: any,
    @CurrentUser() user: UserDto | null,
    @Headers() headers: Record<string, string>,
  ) {
    const userId = this.extractUserId(req, user, headers);
    return this.enrollmentService.getWorkshopProgress(slug, userId);
  }
}
