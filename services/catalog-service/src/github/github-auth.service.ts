import { Injectable, Logger } from '@nestjs/common';
import * as jose from 'jose';
import Redis from 'ioredis';
import { CatalogConfigService } from '../config/catalog.config.js';

@Injectable()
export class GitHubAuthService {
  private readonly logger = new Logger(GitHubAuthService.name);
  private readonly redis: Redis;

  constructor(private readonly config: CatalogConfigService) {
    this.redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async getAppJwt(): Promise<string> {
    const appId = this.config.githubAppId;
    let privateKeyPem = this.config.githubAppPrivateKey;

    if (!appId || !privateKeyPem) {
      throw new Error('GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is not configured');
    }

    // Support base64 encoded private keys or PEM strings
    if (privateKeyPem.startsWith('-----BEGIN') === false) {
      try {
        const decoded = Buffer.from(privateKeyPem, 'base64').toString('utf-8');
        if (decoded.includes('-----BEGIN')) {
          privateKeyPem = decoded;
        }
      } catch {
        // keep as is
      }
    }

    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(appId)
      .setIssuedAt(now - 60)
      .setExpirationTime(now + 600)
      .sign(privateKey);

    return jwt;
  }

  async getInstallationToken(installationId: string): Promise<string> {
    const cacheKey = `github:install_token:${installationId}`;

    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => {});
      }
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err: any) {
      this.logger.warn(`Redis cache get error for github token: ${err.message}`);
    }

    const appJwt = await this.getAppJwt();
    const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'handrail-catalog-service',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to exchange GitHub installation token (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { token: string; expires_at: string };

    try {
      // GitHub installation tokens expire in 1 hour; cache for 50 minutes (3000s)
      await this.redis.set(cacheKey, data.token, 'EX', 3000);
    } catch (err: any) {
      this.logger.warn(`Redis cache set error: ${err.message}`);
    }

    return data.token;
  }
}
