import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ServiceOnly } from '@app/auth';
import { InternalAuthGuard } from './internal-auth.guard.js';
import { InternalService } from './internal.service.js';

@Controller('internal')
@UseGuards(InternalAuthGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Get('workshops/:slug/resolve')
  @ServiceOnly('catalog:read')
  async resolveWorkshop(@Param('slug') slug: string) {
    return this.internalService.resolveWorkshop(slug);
  }

  @Get('versions/:versionId/structure')
  @ServiceOnly('catalog:read')
  async getVersionStructure(@Param('versionId') versionId: string) {
    return this.internalService.getVersionStructure(versionId);
  }

  @Get('versions/:versionId/chapters/:chapterId/tests')
  @ServiceOnly('catalog:tests:read')
  async getChapterTests(
    @Param('versionId') versionId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.internalService.getChapterTests(versionId, chapterId);
  }
}
