import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { DeliveryService } from './delivery.service.js';

@Controller('v1/workshops')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get(':slug/starter')
  async getStarter(
    @Param('slug') slug: string,
    @Query('language') language: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.deliveryService.getStarterDownloadUrl(slug, language, user);
  }
}
