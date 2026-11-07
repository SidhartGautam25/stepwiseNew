import { SetMetadata } from '@nestjs/common';
import type { RouteAuthMode } from '@app/contracts';

export const AUTH_MODE_KEY = 'authMode';
export const AuthMode = (mode: RouteAuthMode) => SetMetadata(AUTH_MODE_KEY, mode);
