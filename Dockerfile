# syntax=docker/dockerfile:1

# One Dockerfile, two images. `--target feed` builds the quote sidecar,
# `--target web` builds nginx serving the compiled Angular bundle. Compose
# builds both; neither final stage runs as root.

# ---------- shared base ----------
FROM node:22-alpine AS base
WORKDIR /app

# ---------- Angular build ----------
FROM base AS web-build
# Dependencies first so a source-only change does not reinstall node_modules.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.app.json angular.json ./
COPY shared ./shared
COPY public ./public
COPY src ./src
RUN npm run build
# Angular 19 emits the browser bundle into dist/<project>/browser.
RUN test -f dist/stock-dashboard/browser/index.html

# ---------- web runtime ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
# The unprivileged image already runs as uid 101 and listens on 8080.
COPY --chown=nginx:nginx docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build --chown=nginx:nginx /app/dist/stock-dashboard/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

# ---------- feed runtime ----------
FROM base AS feed
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --no-audit --no-fund --omit=dev --prefix server
COPY server ./server
COPY shared ./shared
# node:alpine ships an unprivileged `node` user; the app needs no write access.
USER node
EXPOSE 7202
ENV HOST=0.0.0.0 PORT=7202
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:7202/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
