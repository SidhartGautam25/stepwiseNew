import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthLibModule, JwtAuthGuard } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { ProfileConfigService } from './config/profile.config.js';
import { ProfileRepository } from './profile/profile.repository.js';
import { ProfileService } from './profile/profile.service.js';
import { ProfileController } from './profile/profile.controller.js';
import { EnrollmentRepository } from './enrollment/enrollment.repository.js';
import { EnrollmentService } from './enrollment/enrollment.service.js';
import { EnrollmentController } from './enrollment/enrollment.controller.js';
import { InternalAccessController } from './access/internal-access.controller.js';
import { InternalAuthGuard } from './internal/internal-auth.guard.js';
import { LiveController } from './live/live.controller.js';
import { AuthEventConsumerService } from './events/auth-event-consumer.service.js';
import { PaymentEventConsumerService } from './events/payment-event-consumer.service.js';
import { ProfileEventPublisherService } from './events/profile-event-publisher.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthLibModule.forRoot({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
      jwksUri: process.env.SUPABASE_JWKS_URI,
      issuer: process.env.SUPABASE_ISSUER,
      audience: process.env.SUPABASE_AUDIENCE || 'authenticated',
      clockTolerance: 30,
    }),
  ],
  controllers: [
    HealthController,
    ProfileController,
    EnrollmentController,
    InternalAccessController,
    LiveController,
  ],
  providers: [
    PrismaService,
    ProfileConfigService,
    ProfileRepository,
    ProfileService,
    EnrollmentRepository,
    EnrollmentService,
    InternalAuthGuard,
    ProfileEventPublisherService,
    AuthEventConsumerService,
    PaymentEventConsumerService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Defense-in-depth: verifies tokens locally
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
