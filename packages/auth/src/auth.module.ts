import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ServiceAuthGuard } from './guards/service-auth.guard.js';
import { TokenRevocationService } from './services/token-revocation.service.js';
import type { AuthModuleOptions } from './interfaces/token-strategy.interface.js';

export const AUTH_OPTIONS = 'AUTH_MODULE_OPTIONS';

@Global()
@Module({
  providers: [
    SupabaseJwtVerifier,
    TokenRevocationService,
    JwtAuthGuard,
    RolesGuard,
    ServiceAuthGuard,
  ],
  exports: [
    SupabaseJwtVerifier,
    TokenRevocationService,
    JwtAuthGuard,
    RolesGuard,
    ServiceAuthGuard,
  ],
})
export class AuthLibModule {
  static forRoot(options: AuthModuleOptions = {}): DynamicModule {
    const verifierProvider: Provider = {
      provide: SupabaseJwtVerifier,
      useFactory: () => {
        return new SupabaseJwtVerifier(options);
      },
    };

    return {
      module: AuthLibModule,
      global: true,
      providers: [
        {
          provide: AUTH_OPTIONS,
          useValue: options,
        },
        verifierProvider,
        TokenRevocationService,
        JwtAuthGuard,
        RolesGuard,
        ServiceAuthGuard,
      ],
      exports: [
        AUTH_OPTIONS,
        SupabaseJwtVerifier,
        TokenRevocationService,
        JwtAuthGuard,
        RolesGuard,
        ServiceAuthGuard,
      ],
    };
  }

  static forRootAsync(asyncOptions: {
    useFactory: (...args: any[]) => Promise<AuthModuleOptions> | AuthModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const optionsProvider: Provider = {
      provide: AUTH_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject || [],
    };

    const verifierProvider: Provider = {
      provide: SupabaseJwtVerifier,
      useFactory: (options: AuthModuleOptions) => {
        return new SupabaseJwtVerifier(options);
      },
      inject: [AUTH_OPTIONS],
    };

    return {
      module: AuthLibModule,
      global: true,
      imports: [],
      providers: [
        optionsProvider,
        verifierProvider,
        TokenRevocationService,
        JwtAuthGuard,
        RolesGuard,
        ServiceAuthGuard,
      ],
      exports: [
        AUTH_OPTIONS,
        SupabaseJwtVerifier,
        TokenRevocationService,
        JwtAuthGuard,
        RolesGuard,
        ServiceAuthGuard,
      ],
    };
  }
}

// Backward-compatible alias
export const AuthModule = AuthLibModule;
