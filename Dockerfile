FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.check.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY workers ./workers
COPY scripts ./scripts
RUN npm ci
ARG PACT_WEB_BASE_PATH=/
ARG PACT_TELEGRAM_BASE_PATH=/telegram/
ENV PACT_WEB_BASE_PATH=$PACT_WEB_BASE_PATH
ENV PACT_TELEGRAM_BASE_PATH=$PACT_TELEGRAM_BASE_PATH
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
COPY --from=build /app/workers ./workers
COPY --from=build /app/scripts ./scripts
COPY infra/production/container-entrypoint.sh /usr/local/bin/pact-entrypoint
RUN chmod 0555 /usr/local/bin/pact-entrypoint
ENTRYPOINT ["pact-entrypoint"]

FROM caddy:2.10.2-alpine AS gateway
COPY infra/production/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/apps/telegram/dist /srv/telegram
