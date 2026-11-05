import { Controller, Get, SetMetadata } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

const Public = () => SetMetadata('isPublic', true);

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  private readonly serviceName = process.env.SERVICE_NAME || 'service';

  @Public()
  @Get()
  @ApiOperation({ summary: 'Service health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      service: this.serviceName,
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
