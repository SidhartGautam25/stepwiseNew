import { PrismaClient } from '../services/auth-service/src/generated/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://handrail:handrail_password@localhost:5432/handrail_db',
      },
    },
  });

  try {
    // 1. Create postgres role if it doesn't exist (required by Supabase GoTrue migrations)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
          CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'handrail_password';
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON DATABASE handrail_db TO postgres;`);

    // 2. Required extensions
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // 3. Auth schema
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS auth;');
    await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA auth TO postgres;');
    await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA auth TO handrail;');

    console.log('✅ PostgreSQL auth schema, postgres role, and required extensions verified/created.');
  } catch (err: any) {
    console.error('Failed to init auth schema:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
