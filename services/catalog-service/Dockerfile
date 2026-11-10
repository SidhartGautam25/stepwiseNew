FROM node:22-alpine AS builder

RUN apk add --no-cache git libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy packages
COPY packages/ ./packages/

# Copy services/catalog-service
COPY services/catalog-service/ ./services/catalog-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client for catalog-service
RUN pnpm --filter catalog-service exec prisma generate

# Build packages and service
RUN pnpm --filter @app/content-core build
RUN pnpm --filter @app/contracts build
RUN pnpm --filter @app/auth build
RUN pnpm --filter @app/common build
RUN pnpm --filter catalog-service build

FROM node:22-alpine AS runner

RUN apk add --no-cache git libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4001

COPY --from=builder /app /app

WORKDIR /app/services/catalog-service

EXPOSE 4001

CMD ["node", "dist/main.js"]
