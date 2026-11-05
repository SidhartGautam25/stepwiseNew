import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware, HealthController } from '@app/common';
import { HelloController } from './hello.controller.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, HelloController, RealtimeController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

