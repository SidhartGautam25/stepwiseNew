import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Body,
  Inject,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';
import { ContentSyncService } from './content-sync.service.js';
import * as path from 'path';

@ApiTags('Internal Content Sync')
@Controller('internal/content')
export class ContentSyncController {
  constructor(
    @Inject(ContentSyncService)
    private readonly syncService: ContentSyncService,
  ) {}

  @Public()
  @Post('sync')
  @ApiOperation({ summary: 'Sync workshop content from filesystem or CI pipeline' })
  @ApiHeader({ name: 'x-internal-token', required: true, description: 'CI internal authentication token' })
  @ApiResponse({ status: 200, description: 'Content sync successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Invalid internal token' })
  async syncContent(
    @Headers('x-internal-token') token?: string,
    @Body() body?: { contentDir?: string },
  ) {
    const expectedToken = process.env.INTERNAL_SYNC_TOKEN || 'dev_internal_sync_token_secret';
    if (!token || token !== expectedToken) {
      throw new UnauthorizedException('Invalid or missing internal sync token');
    }

    const contentDir = body?.contentDir || path.resolve(process.cwd(), '../../content');
    return this.syncService.syncFromDirectory(contentDir);
  }
}

