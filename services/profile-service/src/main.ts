import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger } from '@app/common';

async function bootstrap() {
  const logger = new StructuredLogger('profile-service');
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Handrail Profile Service')
    .setDescription('User profiles, preferences, enrollment, progress, activity, and live status')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_PROGRESS || process.env.PORT_PROFILE || 4004;
  await app.listen(port);
  logger.log(`Profile Service is running on port ${port}`, 'Bootstrap');
}

bootstrap();
