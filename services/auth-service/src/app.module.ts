import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AuthLibModule, JwtAuthGuard } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from './prisma.service.js';
import { SupabaseAdminService, SupabaseAnonServiceFactory } from './supabase/supabase-client.service.js';
import { AuthExceptionFilter } from './filters/auth-exception.filter.js';
import { RabbitMqPublisherService } from './outbox/rabbitmq-publisher.service.js';
import { OutboxPublisherService } from './outbox/outbox-publisher.service.js';

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
  controllers: [HealthController, AuthController],
  providers: [
    PrismaService,
    SupabaseAdminService,
    SupabaseAnonServiceFactory,
    AuthService,
    RabbitMqPublisherService,
    OutboxPublisherService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
  ],
  exports: [
    PrismaService,
    AuthService,
    RabbitMqPublisherService,
    OutboxPublisherService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
