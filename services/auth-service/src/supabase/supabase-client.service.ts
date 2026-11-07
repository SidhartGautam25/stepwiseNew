import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes requests to standalone Supabase GoTrue instances where endpoints
 * are mounted directly at root (e.g. /token, /signup, /user) rather than behind
 * Kong's /auth/v1/ routing prefix.
 */
function createSupabaseFetch() {
  return (input: any, init?: any) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url;
    if (typeof url === 'string' && url.includes('/auth/v1/')) {
      url = url.replace('/auth/v1/', '/');
    }
    return fetch(url, init);
  };
}

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private client: SupabaseClient | null = null;
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    this.serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      'dummy-service-role-key-for-local-dev';

    try {
      this.client = createClient(this.supabaseUrl, this.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: createSupabaseFetch(),
        },
      });
      this.logger.log(`Initialized Supabase Admin Client for ${this.supabaseUrl}`);
    } catch (err: any) {
      this.logger.error(`Failed to initialize Supabase Admin Client: ${err.message}`);
    }
  }

  get admin() {
    if (!this.client) {
      throw new Error('Supabase Admin Client is not initialized');
    }
    return this.client.auth.admin;
  }

  /**
   * Platform roles are single-source-of-truth in app_metadata.roles
   * and must ONLY be written through this admin method.
   */
  async updateUserRoles(userId: string, roles: string[]): Promise<void> {
    const { error } = await this.admin.updateUserById(userId, {
      app_metadata: { roles },
    });
    if (error) {
      throw error;
    }
  }

  async getUserById(userId: string) {
    const { data, error } = await this.admin.getUserById(userId);
    if (error) {
      throw error;
    }
    return data.user;
  }

  async globalSignOut(jwtToken: string): Promise<void> {
    const { error } = await this.admin.signOut(jwtToken, 'global');
    if (error) {
      throw error;
    }
  }
}

@Injectable()
export class SupabaseAnonServiceFactory {
  private readonly supabaseUrl: string;
  private readonly anonKey: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    this.anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'dummy-anon-key-for-local-dev';
  }

  /**
   * Creates a dedicated anon-key SupabaseClient instance with no session persistence
   * and no auto refresh.
   */
  createClient(customStorage?: any): SupabaseClient {
    return createClient(this.supabaseUrl, this.anonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: Boolean(customStorage),
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: customStorage,
      },
      global: {
        fetch: createSupabaseFetch(),
      },
    });
  }
}
