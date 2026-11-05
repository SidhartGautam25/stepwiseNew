import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';
import { JwtVerifierService } from '@app/auth';
import { setupStaticProxies } from './proxy.middleware.js';

async function bootstrap() {
  const logger = new StructuredLogger('api-gateway');
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  // Setup static proxies with perimeter JWT verification
  const verifier = app.get(JwtVerifierService);
  setupStaticProxies(app, verifier);

  // OpenAPI Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Handrail API Gateway')
    .setDescription('Handrail API Gateway and Edge Routing')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PORT_API_GATEWAY || 4000;
  await app.listen(port);
  logger.log(`API Gateway is running on port ${port}`, 'Bootstrap');
}

bootstrap();

