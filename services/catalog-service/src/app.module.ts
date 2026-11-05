import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { HelloController } from './hello.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, HelloController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
