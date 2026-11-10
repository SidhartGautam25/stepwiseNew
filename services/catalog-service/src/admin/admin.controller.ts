import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { AdminService } from './admin.service.js';

class RegisterWorkshopDto {
  slug!: string;
  repoFullName!: string;
  access?: string;
  installationId?: string;
}

class PublishVersionDto {
  version!: string;
  releaseNotes?: string;
}

class DeprecateVersionDto {
  version!: string;
  reason?: string;
}

@Controller('v1/admin/workshops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async registerWorkshop(
    @Body() body: RegisterWorkshopDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.adminService.registerWorkshop({
      slug: body.slug,
      repoFullName: body.repoFullName,
      access: body.access,
      installationId: body.installationId,
      actor: user?.id || 'admin',
    });
  }

  @Get()
  async listWorkshops() {
    return this.adminService.listWorkshops();
  }

  @Post(':slug/sync')
  async triggerSync(
    @Param('slug') slug: string,
    @Body() body: { force?: boolean },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.adminService.triggerSync(slug, body?.force, user?.id || 'admin');
  }

  @Get(':slug/versions')
  async listVersions(@Param('slug') slug: string) {
    return this.adminService.listVersions(slug);
  }

  @Post(':slug/versions/:versionId/publish')
  async publishVersion(
    @Param('slug') slug: string,
    @Param('versionId') versionId: string,
    @Body() body: PublishVersionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.adminService.publishVersion(slug, versionId, body, user?.id || 'admin');
  }

  @Post(':slug/deprecate')
  async deprecateVersion(
    @Param('slug') slug: string,
    @Body() body: DeprecateVersionDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.adminService.deprecateVersion(slug, body, user?.id || 'admin');
  }
}
