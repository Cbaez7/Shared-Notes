# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV NODE_ENV=production

FROM base AS build
WORKDIR /app
COPY package-lock.json package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --include=dev
COPY client client
COPY server server
RUN npm run build -w client \
  && npm run build -w server \
  && mkdir -p /stage/client-dist /stage/server \
  && cp -r client/dist/. /stage/client-dist/ \
  && cp -r server/dist /stage/server/dist \
  && cp server/package.json /stage/server/ \
  && cp package.json package-lock.json /stage/

FROM base AS runtime
WORKDIR /app
ENV PORT=8080 \
    DATABASE_PATH=/data/sharednotes.db \
    CLIENT_DIST=/app/client-dist \
    NODE_ENV=production
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --home /app app
COPY --from=build /stage/server /app/server
COPY --from=build /stage/client-dist /app/client-dist
COPY --from=build /stage/package.json /stage/package-lock.json ./
RUN mkdir -p /data && chown app:app /data \
  && cd server && npm ci --omit=dev && chown -R app:app /app
USER app
VOLUME /data
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
