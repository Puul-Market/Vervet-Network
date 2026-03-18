import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment';

const logger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(
    'Unhandled promise rejection — keeping process alive',
    reason instanceof Error ? reason.stack : String(reason),
  );
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal('Uncaught exception — shutting down', error.stack);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const allowedOrigins = configService.get('CORS_ALLOWED_ORIGINS', {
    infer: true,
  });

  app.setGlobalPrefix('v1');
  app.enableCors({
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Admin-Token',
      'X-Request-Nonce',
      'X-Request-Timestamp',
    ],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin '${origin}' is not allowed by CORS.`), false);
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Vervet Network API')
      .setDescription(
        'Recipient-first wallet resolution, partner attestations, and webhook operations.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addApiKey(
        {
          in: 'header',
          name: 'x-admin-token',
          type: 'apiKey',
        },
        'admin-token',
      )
      .build(),
  );
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs/json',
  });

  const port = configService.get('PORT', { infer: true });

  await app.listen(port);
}

void bootstrap();
