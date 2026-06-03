# Production Dockerfile for Next.js App
# Build context must be the repository root
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace package.json files for dependency resolution
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies without running local Git hook lifecycle scripts in the container build.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Preserve pnpm's symlinked dependency tree exactly as installed.
COPY --from=deps /app ./
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG API_URL
ENV API_URL=$API_URL
ARG APP_URL
ENV APP_URL=$APP_URL
ARG S3_ENDPOINT
ENV S3_ENDPOINT=$S3_ENDPOINT
ARG S3_PUBLIC_URL
ENV S3_PUBLIC_URL=$S3_PUBLIC_URL

# Build Next.js app
RUN cd apps/web && pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# With outputFileTracingRoot set to monorepo root, the standalone output
# preserves the monorepo directory structure:
#   .next/standalone/apps/web/server.js
#   .next/standalone/packages/shared/...
#   .next/standalone/node_modules/...

# Copy standalone output (includes server.js, traced node_modules, shared packages)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Set the correct permission for prerender cache
RUN mkdir -p apps/web/.next
RUN chown nextjs:nodejs apps/web/.next

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is inside the apps/web subdirectory in monorepo standalone output
CMD ["node", "apps/web/server.js"]
