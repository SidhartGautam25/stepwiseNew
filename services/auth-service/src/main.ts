import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger } from '@app/common';
import { AuthExceptionFilter } from './filters/auth-exception.filter.js';

async function bootstrap() {
  const logger = new StructuredLogger('auth-service');
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  app.useGlobalFilters(new AuthExceptionFilter());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Handrail Auth Service')
    .setDescription('Identity provider wrapper, session management, and auth tokens')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_AUTH || 4006;
  await app.listen(port);
  logger.log(`Auth Service is running on port ${port}`, 'Bootstrap');
}

bootstrap();
