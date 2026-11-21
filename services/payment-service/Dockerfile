FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy packages
COPY packages/ ./packages/

# Copy services/payment-service
COPY services/payment-service/ ./services/payment-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client for payment-service
RUN pnpm --filter payment-service exec prisma generate

# Build packages and service
RUN pnpm --filter @app/contracts build
RUN pnpm --filter @app/auth build
RUN pnpm --filter @app/common build
RUN pnpm --filter payment-service build

FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4007

COPY --from=builder /app /app

WORKDIR /app/services/payment-service

EXPOSE 4007

CMD ["node", "dist/main.js"]
