import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { HelloController } from './hello.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { ContentSyncService } from './sync/content-sync.service.js';
import { ContentSyncController } from './sync/content-sync.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [
    HealthController,
    HelloController,
    CatalogController,
    ContentSyncController,
  ],
  providers: [PrismaService, CatalogService, ContentSyncService],
  exports: [PrismaService, CatalogService, ContentSyncService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
