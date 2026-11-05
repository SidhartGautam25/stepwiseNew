import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';
import { CatalogService } from './catalog.service.js';
import type { ContentLevel } from '@app/contracts';

@ApiTags('Workshops')
@Controller('v1/workshops')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all available guided workshops' })
  @ApiResponse({ status: 200, description: 'List of workshop summaries' })
  listWorkshops() {
    return this.catalogService.listWorkshops();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get workshop overview including chapters and steps' })
  @ApiResponse({ status: 200, description: 'Workshop overview' })
  @ApiResponse({ status: 404, description: 'Workshop not found' })
  getWorkshopOverview(@Param('slug') slug: string) {
    return this.catalogService.getWorkshopOverview(slug);
  }

  @Public()
  @Get(':slug/steps/:stepSlug')
  @ApiOperation({ summary: 'Get step details with 3-level content and tests' })
  @ApiQuery({
    name: 'level',
    required: false,
    enum: ['beginner', 'intermediate', 'expert'],
    description: 'Preferred depth level',
  })
  @ApiResponse({ status: 200, description: 'Step details' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  getStepDetail(
    @Param('slug') slug: string,
    @Param('stepSlug') stepSlug: string,
    @Query('level') level?: ContentLevel,
  ) {
    return this.catalogService.getStepDetail(slug, stepSlug, level);
  }
}

