import { Injectable, Logger } from '@nestjs/common';

export interface DenylistCheckParams {
  userId: string;
  sessionId?: string;
  iat?: number;
}

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private inMemoryRevoked = new Set<string>();
  private customChecker?: (userId: string, sessionId?: string, iat?: number) => Promise<boolean>;
  private customRevoker?: (userId: string, sessionId?: string) => Promise<void>;

  setChecker(checker: (userId: string, sessionId?: string, iat?: number) => Promise<boolean>) {
    this.customChecker = checker;
  }

  setRevoker(revoker: (userId: string, sessionId?: string) => Promise<void>) {
    this.customRevoker = revoker;
  }

  /**
   * Adds a session or user to the revocation denylist
   */
  async revokeSession(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      this.inMemoryRevoked.add(`session:${sessionId}`);
    }
    this.inMemoryRevoked.add(`user:${userId}`);

    if (this.customRevoker) {
      try {
        await this.customRevoker(userId, sessionId);
      } catch (err: any) {
        this.logger.error(`Error delegating session revocation: ${err.message}`);
      }
    }
  }

  /**
   * Evaluates if a given token/session/user has been revoked
   */
  async isRevoked(params: DenylistCheckParams): Promise<boolean> {
    if (params.sessionId && this.inMemoryRevoked.has(`session:${params.sessionId}`)) {
      return true;
    }
    if (this.inMemoryRevoked.has(`user:${params.userId}`)) {
      return true;
    }

    if (this.customChecker) {
      try {
        return await this.customChecker(params.userId, params.sessionId, params.iat);
      } catch (err: any) {
        this.logger.error(`Error checking token revocation denylist: ${err.message}`);
        return false;
      }
    }
    return false;
  }
}
