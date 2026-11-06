import { Controller, Get, Post, Param, Query, Res, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { JwtAuthGuard, Public } from '@app/auth';
import { StarterService } from './starter.service.js';

@ApiTags('Starters')
@Controller()
export class StarterController {
  constructor(private readonly starterService: StarterService) {}

  @Get(['v1/starters/:slug/:language', ':slug/:language'])
  @Post(['v1/starters/:slug/:language', ':slug/:language'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get starter metadata, signed download URL, and git setup instructions' })
  @ApiResponse({ status: 200, description: 'Starter package details with signed URL' })
  @ApiResponse({ status: 404, description: 'Starter template not found' })
  async getStarterInfo(
    @Param('slug') slug: string,
    @Param('language') language: string,
    @Req() req: Request,
  ) {
    const gatewayUrl = (req.headers['x-forwarded-host']
      ? `${req.protocol}://${req.headers['x-forwarded-host']}`
      : undefined);
    return this.starterService.getStarterInfo(slug, language.toLowerCase(), gatewayUrl);
  }

  @Public()
  @Get(['v1/starters/:slug/:language/download', ':slug/:language/download'])
  @ApiOperation({ summary: 'Download starter archive via signed HMAC URL' })
  @ApiQuery({ name: 'sig', required: false, description: 'HMAC download signature' })
  @ApiQuery({ name: 'expires', required: false, description: 'Signature expiry timestamp (Unix epoch)' })
  @ApiResponse({ status: 200, description: 'Zip archive download stream' })
  @ApiResponse({ status: 401, description: 'Signature expired or invalid' })
  async downloadStarter(
    @Param('slug') slug: string,
    @Param('language') language: string,
    @Query('sig') sig: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ) {
    const buffer = await this.starterService.getDownloadBuffer(
      slug,
      language.toLowerCase(),
      sig,
      expires,
    );

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-${language.toLowerCase()}-starter.zip"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buffer);
  }
}

