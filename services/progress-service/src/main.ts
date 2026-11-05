import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';

async function bootstrap() {
  const logger = new StructuredLogger('progress-service');
  const app = await NestFactory.create(AppModule, { logger });

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Handrail Progress Service')
    .setDescription('Learner enrollment, step progress tracking, and unlocks')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_PROGRESS || 4004;
  await app.listen(port);
  logger.log(`Progress Service running on port ${port}`, 'Bootstrap');
}

bootstrap();

