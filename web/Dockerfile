FROM node:20-alpine AS build

WORKDIR /app
RUN corepack enable

# Copy only dependency manifests first (better layer caching)
COPY webapp/package.json webapp/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY webapp/ ./

RUN pnpm build

# ---- serve with nginx ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/ /usr/share/nginx/html

EXPOSE 80