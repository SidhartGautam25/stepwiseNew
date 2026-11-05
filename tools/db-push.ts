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
  { name: 'catalog-service', schema: 'services/catalog-service/prisma/schema.prisma' },
  { name: 'starter-service', schema: 'services/starter-service/prisma/schema.prisma' },
  { name: 'verification-service', schema: 'services/verification-service/prisma/schema.prisma' },
  { name: 'progress-service', schema: 'services/progress-service/prisma/schema.prisma' },
];

console.log('[Handrail DB Sync] Pushing Prisma schemas to PostgreSQL...\n');

let allSuccess = true;
for (const service of services) {
  const schemaPath = path.resolve(process.cwd(), service.schema);
  if (!fs.existsSync(schemaPath)) {
    console.warn(`[Handrail DB Sync] Schema not found for ${service.name}: ${schemaPath}`);
    continue;
  }

  console.log(`[Handrail DB Sync] Pushing schema for ${service.name}...`);
  try {
    execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
      stdio: 'inherit',
      env: process.env,
      shell: true as any,
    });
    console.log(`✅ ${service.name} schema synced.\n`);
  } catch (err: any) {
    console.error(`❌ Failed to push schema for ${service.name}.\n`);
    allSuccess = false;
  }
}

if (!allSuccess) {
  console.error('[Handrail DB Sync] Some schemas failed to push. Ensure PostgreSQL is running on port 5432.');
  process.exit(1);
} else {
  console.log('🎉 All PostgreSQL database schemas and tables are up to date!');
}

