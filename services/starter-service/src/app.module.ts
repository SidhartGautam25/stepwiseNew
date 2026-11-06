import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { HelloController } from './hello.controller.js';
import { StarterController } from './starter.controller.js';
import { StarterRepository } from './starter.repository.js';
import { StarterService } from './starter.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, HelloController, StarterController],
  providers: [PrismaService, StarterRepository, StarterService],
  exports: [PrismaService, StarterRepository, StarterService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
