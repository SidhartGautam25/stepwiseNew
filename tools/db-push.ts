import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Load root .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile(envPath);
  } catch {
    // ignore
  }
}

const services = [
  'catalog-service',
  'starter-service',
  'verification-service',
  'progress-service',
];

console.log('[Handrail DB Sync] Pushing Prisma schemas to PostgreSQL...\n');

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
  console.log('🎉 All PostgreSQL database schemas and tables are up to date!');
}
