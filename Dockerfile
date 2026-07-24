FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /var/www/mamator/uploads && chown -R nextjs:nodejs /var/www/mamator
USER nextjs
EXPOSE 3005
CMD ["node", "server.js"]
