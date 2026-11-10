import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';

async function bootstrap() {
  const logger = new StructuredLogger('catalog-service');
  const app = await NestFactory.create(AppModule, {
    logger,
    rawBody: true,
  });

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Handrail Catalog Service')
    .setDescription('Catalog, Workshops, Versions, Ingest and Artifacts')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_CATALOG || 4001;
  await app.listen(port);
  logger.log(`Catalog Service running on port ${port}`, 'Bootstrap');
}

bootstrap();
