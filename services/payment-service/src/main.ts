import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';

async function bootstrap() {
  const logger = new StructuredLogger('payment-service');
  const app = await NestFactory.create(AppModule, {
    logger,
    rawBody: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Handrail Payment Service')
    .setDescription('Razorpay payments, orders, verification, and webhook processing')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_PAYMENT || 4007;
  await app.listen(port, '0.0.0.0');
  logger.log(`Payment Service running on port ${port}`, 'Bootstrap');
}

bootstrap();
