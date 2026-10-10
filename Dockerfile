# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
# OpenSSL : requis par le moteur de migration de Prisma sur Alpine
RUN apk add --no-cache openssl && npm install -g pnpm@12.10.1
WORKDIR /repo

# 1. Installe et compile tout le monorepo
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# Une copie autonome par app, avec ses seules dépendances de prod
RUN pnpm --filter @phenix/bot --prod deploy /out/bot \
 && pnpm --filter @phenix/api --prod deploy /out/api

# 2. Migrations : garde le CLI Prisma et ses moteurs
FROM build AS migrate
WORKDIR /repo/packages/database
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# 3. Bot
FROM node:24-alpine AS bot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/bot .
USER node
CMD ["node", "dist/index.js"]

# 4. API
FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/api .
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

# 5. Panel : sortie standalone de Next
FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]