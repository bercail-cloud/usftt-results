# Stage 1: base
FROM node:22-alpine AS base
WORKDIR /app

# Stage 2: deps (production only)
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci --omit=dev

# Stage 3: builder (full build)
FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npx turbo run build

# Stage 4: api
FROM base AS api
RUN apk add --no-cache netcat-openbsd \
 && addgroup -g 1001 -S nodeapp \
 && adduser -u 1001 -S nodeapp -G nodeapp
COPY --from=deps --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=nodeapp:nodeapp /app/package.json ./
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/api/package.json ./packages/api/
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/api/src/db/migrations ./packages/api/src/db/migrations
COPY --from=builder --chown=nodeapp:nodeapp /app/packages/api/scripts/ ./packages/api/scripts/
COPY --chown=nodeapp:nodeapp docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER nodeapp
ENTRYPOINT ["./docker-entrypoint.sh"]

# Stage 5: web
FROM nginx:alpine AS web
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
