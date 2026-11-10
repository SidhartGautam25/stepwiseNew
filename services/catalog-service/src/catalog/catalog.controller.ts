import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, Public, CurrentUser } from '@app/auth';
import type { AuthenticatedUser, ContentLevel } from '@app/contracts';
import { CatalogService } from './catalog.service.js';

@Controller('v1/workshops')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  async listWorkshops() {
    return this.catalogService.listWorkshops();
  }

  @Public()
  @Get(':slug')
  async getWorkshop(
    @Param('slug') slug: string,
    @Query('version') version?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.catalogService.getWorkshopBySlug(slug, version, user);
  }

  @Get(':slug/chapters/:chapterId')
  async getChapter(
    @Param('slug') slug: string,
    @Param('chapterId') chapterId: string,
    @Query('level') level?: ContentLevel,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.catalogService.getGatedChapter(slug, chapterId, level, user);
  }

  @Get(':slug/chapters/:chapterId/steps/:stepId')
  async getStep(
    @Param('slug') slug: string,
    @Param('chapterId') chapterId: string,
    @Param('stepId') stepId: string,
    @Query('level') level?: ContentLevel,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.catalogService.getGatedStep(slug, chapterId, stepId, level, user);
  }
}

