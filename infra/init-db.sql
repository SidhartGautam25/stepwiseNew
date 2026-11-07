-- Create postgres role if it doesn't exist (required by Supabase GoTrue migrations)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'handrail_password';
  END IF;
END $$;
GRANT ALL PRIVILEGES ON DATABASE handrail_db TO postgres;

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Service and Auth schemas
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA auth TO handrail;
CREATE SCHEMA IF NOT EXISTS auth_svc;
CREATE SCHEMA IF NOT EXISTS profile_svc;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS starter;
CREATE SCHEMA IF NOT EXISTS verification;
CREATE SCHEMA IF NOT EXISTS progress;

