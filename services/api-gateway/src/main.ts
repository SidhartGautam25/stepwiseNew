import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { StructuredLogger, AllExceptionsFilter } from '@app/common';
import { SupabaseJwtVerifier, TokenRevocationService } from '@app/auth';
import { setupGatewayProxy } from './proxy.middleware.js';

async function bootstrap() {
  const logger = new StructuredLogger('api-gateway');

  // Disable automatic body parser to ensure http-proxy-middleware streams bodies and SSE without buffering
  const app = await NestFactory.create(AppModule, {
    logger,
    bodyParser: false,
  });

  // 1. Helmet security headers
  app.use(helmet());

  // 2. Strict CORS allowlist with credentials (never wildcard)
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, true);
      }
      const cleanOrigin = origin.toLowerCase().replace(/\/+$/, '');
      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-Id',
      'x-request-id',
    ],
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  // 3. Setup streaming gateway proxies with perimeter auth & route enforcement
  const jwtVerifier = app.get(SupabaseJwtVerifier);
  const revocationService = app.get(TokenRevocationService, { strict: false });
  setupGatewayProxy(app, jwtVerifier, revocationService);

  // 4. OpenAPI Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Handrail API Gateway')
    .setDescription('Handrail Edge Gateway Routing, Perimeter Authentication & Security')
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
