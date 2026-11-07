import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthLibModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { CsrfProtectionMiddleware } from './csrf.middleware.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
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
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(CsrfProtectionMiddleware).forRoutes('*');
  }
}
