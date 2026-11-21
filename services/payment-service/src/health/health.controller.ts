import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  getLive() {
    return { status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', service: 'payment-service' };
    } catch (err: any) {
      return { status: 'error', database: err.message, service: 'payment-service' };
    }
  }
}
