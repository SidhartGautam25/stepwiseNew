import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { HelloController } from './hello.controller.js';
import { EnrollmentController } from './enrollment.controller.js';
import { EnrollmentService } from './enrollment.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, HelloController, EnrollmentController],
  providers: [PrismaService, EnrollmentService],
  exports: [PrismaService, EnrollmentService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
