import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Load root .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const services = [
  'auth-service',
  'profile-service',
  'catalog-service',
  'starter-service',
  'verification-service',
  'progress-service',
];

console.log('[Handrail DB Sync] Pushing Prisma schemas to PostgreSQL...\n');

// 1. Ensure all Prisma clients are generated across services
const authClientDir = path.resolve(process.cwd(), 'services', 'auth-service', 'src', 'generated', 'client');
if (!fs.existsSync(authClientDir)) {
  console.log('[Handrail DB Sync] Generating Prisma client types for all services...\n');
  try {
    execSync('pnpm db:generate', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
      shell: true as any,
    });
  } catch (err: any) {
    console.warn(`[Handrail DB Sync] Prisma generate warning: ${err.message}`);
  }
}

console.log('[Handrail DB Sync] Ensuring extensions and auth schemas exist...\n');
try {
  execSync('tsx tools/init-auth-schema.ts', {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
    shell: true as any,
  });
} catch {
  // Ignore if already prepared
}

let allSuccess = true;
for (const service of services) {
  const serviceDir = path.resolve(process.cwd(), 'services', service);
  if (!fs.existsSync(serviceDir)) {
    console.warn(`[Handrail DB Sync] Service directory not found: ${serviceDir}`);
    continue;
  }

  console.log(`[Handrail DB Sync] Pushing schema for ${service}...`);
  try {
    execSync(`pnpm --filter ${service} exec prisma db push --skip-generate --accept-data-loss`, {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
      shell: true as any,
    });
    console.log(`✅ ${service} schema synced.\n`);
  } catch (err: any) {
    console.error(`❌ Failed to push schema for ${service}.\n`);
    allSuccess = false;
  }
}

if (!allSuccess) {
  console.error('[Handrail DB Sync] Some schemas failed to push. Ensure PostgreSQL is running on port 5432.');
  process.exit(1);
} else {
  console.log('[Handrail DB Sync] Regenerating TypeScript Prisma clients for updated schemas...\n');
  try {
    execSync('pnpm db:generate', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
      shell: true as any,
    });
  } catch (err: any) {
    console.warn(`[Handrail DB Sync] Warning during client regeneration: ${err.message}`);
  }
  console.log('\n🎉 All PostgreSQL database schemas, tables, and TypeScript clients are up to date!');
}
