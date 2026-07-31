# Folio — multi-stage production image (Next.js standalone)
# syntax=docker/dockerfile:1
# P27: runner에서 apk/wget 제거 · node fetch HEALTHCHECK · 컨텍스트 축소

ARG NODE_VERSION=22-alpine

# --- dependencies --------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# --- build ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_FOLIO_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ARG FOLIO_VERSION=1.0.0

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_FOLIO_URL=$NEXT_PUBLIC_FOLIO_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV FOLIO_VERSION=$FOLIO_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# --- runner (standalone only) --------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ARG FOLIO_VERSION=1.0.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV FOLIO_VERSION=$FOLIO_VERSION

# libc6-compat / wget 미설치 → 런타임 레이어 최소화 (HEALTHCHECK는 node fetch)
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
