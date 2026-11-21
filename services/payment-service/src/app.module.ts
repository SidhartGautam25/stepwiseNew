import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@app/auth';
import { CorrelationIdMiddleware } from '@app/common';
import { PrismaService } from './prisma.service.js';
import { PaymentConfigService } from './config/payment.config.js';
import { RazorpayService } from './razorpay/razorpay.service.js';
import { RabbitMqPublisherService } from './rabbitmq/rabbitmq-publisher.service.js';
import { PaymentService } from './payment/payment.service.js';
import { PaymentController } from './payment/payment.controller.js';
import { InternalPaymentController } from './internal/internal-payment.controller.js';
import { HealthController } from './health/health.controller.js';

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
    PaymentController,
    InternalPaymentController,
  ],
  providers: [
    PrismaService,
    PaymentConfigService,
    RazorpayService,
    RabbitMqPublisherService,
    PaymentService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
