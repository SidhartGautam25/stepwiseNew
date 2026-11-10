import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'node:crypto';
import { CatalogConfigService } from '../config/catalog.config.js';

export interface PutObjectResult {
  key: string;
  sha256: string;
  size: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: CatalogConfigService) {
    this.bucket = this.config.s3BucketCatalog;
    this.s3 = new S3Client({
      endpoint: this.config.s3Endpoint,
      region: this.config.s3Region,
      credentials: {
        accessKeyId: this.config.s3AccessKey,
        secretAccessKey: this.config.s3SecretKey,
      },
      forcePathStyle: this.config.s3ForcePathStyle,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket verified: ${this.bucket}`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket ${this.bucket} does not exist. Creating...`);
        try {
          await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.logger.log(`Created bucket: ${this.bucket}`);
        } catch (createErr: any) {
          this.logger.error(`Failed to create bucket ${this.bucket}: ${createErr.message}`);
        }
      } else {
        this.logger.warn(`Could not verify bucket ${this.bucket}: ${err.message}`);
      }
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType?: string,
    expectedSha256?: string,
  ): Promise<PutObjectResult> {
    const computedSha256 = crypto.createHash('sha256').update(body).digest('hex');
    if (expectedSha256 && computedSha256 !== expectedSha256) {
      throw new Error(
        `Artifact sha256 mismatch for ${key}. Expected ${expectedSha256}, got ${computedSha256}`,
      );
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      }),
    );

    return {
      key,
      sha256: computedSha256,
      size: body.length,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!res.Body) {
      throw new Error(`Object body is empty for key: ${key}`);
    }

    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey)}`,
        Key: destKey,
      }),
    );
  }

  async getSignedDownloadUrl(
    key: string,
    ttlSeconds = 300,
    filename?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : undefined,
    });

    return getSignedUrl(this.s3, command, { expiresIn: ttlSeconds });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
