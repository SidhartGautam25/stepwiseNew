import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.coerce.number().default(4001),
  databaseUrl: z.string().min(1),
  redisUrl: z.string().default('redis://localhost:6379'),
  rabbitmqUrl: z.string().default('amqp://localhost:5672'),
  s3Endpoint: z.string().default('http://localhost:9000'),
  s3Region: z.string().default('us-east-1'),
  s3AccessKey: z.string().default('minioadmin'),
  s3SecretKey: z.string().default('minioadminpassword'),
  s3BucketCatalog: z.string().default('handrail-catalog'),
  s3ForcePathStyle: z.boolean().default(true),
  contentSource: z.enum(['local', 'github']).default('local'),
  contentLocalRepos: z.string().default('./content'),
  githubAppId: z.string().optional(),
  githubAppPrivateKey: z.string().optional(),
  githubWebhookSecret: z.string().optional(),
  serviceSecret: z.string().default('dev_internal_sync_token_secret'),
  supabaseJwtSecret: z.string().default('super-secret-jwt-token-with-minimum-32-chars-long!'),
  profileServiceUrl: z.string().default('http://localhost:4004'),
});

export type CatalogConfig = z.infer<typeof ConfigSchema>;

@Injectable()
export class CatalogConfigService {
  private readonly config: CatalogConfig;

  constructor() {
    this.config = ConfigSchema.parse({
      port: process.env.PORT || process.env.PORT_CATALOG,
      databaseUrl: process.env.DATABASE_URL_CATALOG,
      redisUrl: process.env.REDIS_URL,
      rabbitmqUrl: process.env.RABBITMQ_URL,
      s3Endpoint: process.env.S3_ENDPOINT,
      s3Region: process.env.S3_REGION,
      s3AccessKey: process.env.S3_ACCESS_KEY,
      s3SecretKey: process.env.S3_SECRET_KEY,
      s3BucketCatalog: process.env.S3_BUCKET_CATALOG,
      s3ForcePathStyle: true,
      contentSource: (process.env.CONTENT_SOURCE as 'local' | 'github') || 'local',
      contentLocalRepos: process.env.CONTENT_LOCAL_REPOS || './content',
      githubAppId: process.env.GITHUB_APP_ID,
      githubAppPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
      githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      serviceSecret: process.env.SERVICE_SECRET || process.env.INTERNAL_SYNC_TOKEN,
      supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
      profileServiceUrl: process.env.PROFILE_SERVICE_URL || 'http://localhost:4004',
    });
  }

  get port(): number {
    return this.config.port;
  }
  get databaseUrl(): string {
    return this.config.databaseUrl;
  }
  get redisUrl(): string {
    return this.config.redisUrl;
  }
  get rabbitmqUrl(): string {
    return this.config.rabbitmqUrl;
  }
  get s3Endpoint(): string {
    return this.config.s3Endpoint;
  }
  get s3Region(): string {
    return this.config.s3Region;
  }
  get s3AccessKey(): string {
    return this.config.s3AccessKey;
  }
  get s3SecretKey(): string {
    return this.config.s3SecretKey;
  }
  get s3BucketCatalog(): string {
    return this.config.s3BucketCatalog;
  }
  get s3ForcePathStyle(): boolean {
    return this.config.s3ForcePathStyle;
  }
  get contentSource(): 'local' | 'github' {
    return this.config.contentSource;
  }
  get contentLocalRepos(): string {
    return this.config.contentLocalRepos;
  }
  get githubAppId(): string | undefined {
    return this.config.githubAppId;
  }
  get githubAppPrivateKey(): string | undefined {
    return this.config.githubAppPrivateKey;
  }
  get githubWebhookSecret(): string | undefined {
    return this.config.githubWebhookSecret;
  }
  get serviceSecret(): string {
    return this.config.serviceSecret;
  }
  get supabaseJwtSecret(): string {
    return this.config.supabaseJwtSecret;
  }
  get profileServiceUrl(): string {
    return this.config.profileServiceUrl;
  }
}
