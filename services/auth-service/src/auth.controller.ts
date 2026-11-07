import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public, CurrentUser, Roles, JwtAuthGuard, RolesGuard } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { setAuthCookies, clearAuthCookies, extractRefreshToken } from './utils/cookie.util.js';
import {
  validateNextRedirect,
  setPkceCookie,
  extractPkceCookie,
  clearPkceCookie,
} from './utils/oauth.util.js';
import { CORRELATION_ID_HEADER } from '@app/common';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==========================================
  // CORE PUBLIC ENDPOINTS (/v1/auth)
  // ==========================================

  @Public()
  @Post('v1/auth/signup')
  @HttpCode(HttpStatus.OK)
  async signup(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
  ) {
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    const meta = this.extractMeta(req);
    return this.authService.signup({ email, password }, meta);
  }

  @Public()
  @Post('v1/auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    const meta = this.extractMeta(req);
    const result = await this.authService.login({ email, password }, meta);

    setAuthCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresIn: result.session.expiresIn,
    });

    return result;
  }

  @Post('v1/auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Query('scope') scope: 'local' | 'global' = 'local',
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const meta = this.extractMeta(req);
    const token = this.extractBearerToken(req);

    const result = await this.authService.logout(token, {
      scope,
      userId: user?.id,
      sessionId: user?.sessionId,
      ...meta,
    });

    clearAuthCookies(res);
    return result;
  }

  @Public()
  @Post('v1/auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractMeta(req);
    const refreshToken = extractRefreshToken(req);

    const result = await this.authService.refresh(refreshToken || '', meta);

    setAuthCookies(res, {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresIn: result.session.expiresIn,
    });

    return result;
  }

  @Get('v1/auth/me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  // ==========================================
  // GITHUB OAUTH PKCE ENDPOINTS
  // ==========================================

  @Public()
  @Get('v1/auth/oauth/github/start')
  async oauthStart(
    @Query('next') nextParam: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const validatedNext = validateNextRedirect(nextParam);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:4000';
    const redirectUri = `${protocol}://${host}/v1/auth/oauth/callback`;

    const { authorizationUrl, pkceData } = await this.authService.startOAuthGitHub(
      redirectUri,
      validatedNext,
    );

    setPkceCookie(res, pkceData);
    return res.redirect(authorizationUrl);
  }

  @Public()
  @Get('v1/auth/oauth/callback')
  async oauthCallback(
    @Query('code') authCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const meta = this.extractMeta(req);
    const pkceData = extractPkceCookie(req);

    if (!pkceData) {
      return res.redirect('/login?error=invalid_pkce_session');
    }

    try {
      const result = await this.authService.exchangeOAuthCallback(
        authCode,
        pkceData,
        meta,
      );

      setAuthCookies(res, {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        expiresIn: result.session.expiresIn,
      });

      clearPkceCookie(res);
      return res.redirect(result.next);
    } catch {
      clearPkceCookie(res);
      return res.redirect('/login?error=oauth_failed');
    }
  }

  // ==========================================
  // CONFIRMATION & PASSWORD RECOVERY
  // ==========================================

  @Public()
  @Post('v1/auth/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmOtp(
    @Body() body: { token_hash?: string; type?: any },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractMeta(req);
    const result = await this.authService.confirmOtp(
      {
        token_hash: body.token_hash || '',
        type: body.type || 'signup',
      },
      meta,
    );

    if (result.session) {
      setAuthCookies(res, {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        expiresIn: result.session.expiresIn,
      });
    }

    return result;
  }

  @Public()
  @Post('v1/auth/password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() body: { email?: string; redirectTo?: string },
    @Req() req: Request,
  ) {
    const email = body.email?.trim().toLowerCase() || '';
    const validatedRedirect = body.redirectTo
      ? validateNextRedirect(body.redirectTo)
      : undefined;
    const meta = this.extractMeta(req);

    return this.authService.forgotPassword(email, validatedRedirect, meta);
  }

  @Public()
  @Post('v1/auth/password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { password?: string },
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.authService.updatePassword(body.password || '', meta);
  }

  @Post('v1/auth/password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() body: { newPassword?: string },
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const meta = this.extractMeta(req);
    return this.authService.updatePassword(body.newPassword || '', meta, user.id);
  }

  // ==========================================
  // ADMIN USER MANAGEMENT
  // ==========================================

  @Post('v1/auth/admin/users/:id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async adminUpdateRoles(
    @Param('id') targetUserId: string,
    @Body() body: { roles: string[] },
    @Req() req: Request,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    const meta = this.extractMeta(req);
    return this.authService.updateUserRoles(adminUser, targetUserId, body.roles, meta);
  }

  @Post('v1/auth/admin/users/:id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async adminSuspendUser(
    @Param('id') targetUserId: string,
    @Req() req: Request,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    const meta = this.extractMeta(req);
    return this.authService.suspendUser(adminUser, targetUserId, meta);
  }

  @Post('v1/auth/admin/users/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async adminRestoreUser(
    @Param('id') targetUserId: string,
    @Req() req: Request,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    const meta = this.extractMeta(req);
    return this.authService.restoreUser(adminUser, targetUserId, meta);
  }

  // ==========================================
  // MACHINE-TO-MACHINE & INTERNAL ENDPOINTS
  // ==========================================

  @Public()
  @Post('internal/service-token')
  @HttpCode(HttpStatus.OK)
  async getServiceToken(
    @Body() body: { clientId?: string; clientSecret?: string; audience?: string },
  ) {
    return this.authService.issueServiceToken(
      body.clientId || '',
      body.clientSecret || '',
      body.audience,
    );
  }

  @Public()
  @Get('.well-known/jwks.json')
  getJwks() {
    return {
      keys: [],
    };
  }

  private extractMeta(req: Request) {
    return {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId:
        (req.headers['x-request-id'] as string) ||
        (req.headers[CORRELATION_ID_HEADER] as string) ||
        undefined,
    };
  }

  private extractBearerToken(req: Request): string | null {
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return null;
  }
}
