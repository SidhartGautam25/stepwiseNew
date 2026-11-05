import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';

async function bootstrap() {
  const logger = new StructuredLogger('verification-service');
  const app = await NestFactory.create(AppModule, { logger });

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Handrail Verification Service')
    .setDescription('GitHub OIDC verification, test runner telemetry, and verdict evaluation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_VERIFICATION || 4003;
  await app.listen(port);
  logger.log(`Verification Service running on port ${port}`, 'Bootstrap');
}

bootstrap();
