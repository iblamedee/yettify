FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
RUN groupadd -g 1000 user && useradd -u 1000 -g user -m user

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=builder --chown=user:user /app/.next/standalone ./
COPY --from=builder --chown=user:user /app/.next/static ./.next/static
COPY --from=builder --chown=user:user /app/public ./public
COPY --from=builder --chown=user:user /app/prisma ./prisma

USER user

EXPOSE 7860

CMD ["node", "server.js"]
