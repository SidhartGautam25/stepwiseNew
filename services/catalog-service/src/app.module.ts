import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { CatalogConfigService } from './config/catalog.config.js';
import { StorageService } from './storage/storage.service.js';
import { AuditService } from './common/audit.service.js';
import { EventsPublisherService } from './common/events.publisher.js';
import { GitHubAuthService } from './github/github-auth.service.js';
import { GitHubWebhookController } from './github/github-webhook.controller.js';
import { ContentSourceFactory } from './content-source/content-source.factory.js';
import { PackagingService } from './ingest/packaging.service.js';
import { IngestService } from './ingest/ingest.service.js';
import { IngestQueueService } from './ingest/ingest.queue.js';
import { AdminService } from './admin/admin.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminAuditController } from './admin/admin-audit.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { HealthController } from './health/health.controller.js';
import { DeliveryService } from './delivery/delivery.service.js';
import { DeliveryController } from './delivery/delivery.controller.js';
import { ACCESS_POLICY_PORT } from './access/access-policy.port.js';
import { HttpAccessPolicyAdapter } from './access/http-access-policy.adapter.js';
import { CachedAccessPolicyService } from './access/cached-access-policy.service.js';
import { AccessInvalidationConsumer } from './access/access-invalidation.consumer.js';
import { InternalAuthGuard } from './internal/internal-auth.guard.js';
import { InternalService } from './internal/internal.service.js';
import { InternalController } from './internal/internal.controller.js';

@Module({
  imports: [
    AuthModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
  ],
  controllers: [
    HealthController,
    CatalogController,
    AdminController,
    AdminAuditController,
    GitHubWebhookController,
    DeliveryController,
    InternalController,
  ],
  providers: [
    PrismaService,
    CatalogConfigService,
    StorageService,
    AuditService,
    EventsPublisherService,
    GitHubAuthService,
    ContentSourceFactory,
    PackagingService,
    IngestService,
    IngestQueueService,
    AdminService,
    CatalogService,
    DeliveryService,
    HttpAccessPolicyAdapter,
    {
      provide: ACCESS_POLICY_PORT,
      useClass: HttpAccessPolicyAdapter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    CachedAccessPolicyService,
    AccessInvalidationConsumer,
    InternalAuthGuard,
    InternalService,
  ],
  exports: [
    PrismaService,
    CatalogConfigService,
    StorageService,
    AuditService,
    EventsPublisherService,
    ContentSourceFactory,
    PackagingService,
    IngestService,
    IngestQueueService,
    AdminService,
    CatalogService,
    DeliveryService,
    CachedAccessPolicyService,
    InternalService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
