FROM node:20-alpine

ARG SERVICE_PATH
ARG OCI_REVISION=unknown
ARG OCI_SOURCE=https://github.com/cvsz/z-platform
ARG OCI_CREATED=unknown
ARG OCI_VERSION=dev

LABEL org.opencontainers.image.revision="${OCI_REVISION}" \
      org.opencontainers.image.source="${OCI_SOURCE}" \
      org.opencontainers.image.created="${OCI_CREATED}" \
      org.opencontainers.image.version="${OCI_VERSION}"

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY ${SERVICE_PATH}/package.json ./package.json
# The monorepo is resolved by pnpm, whose peer resolution accepts the
# currently pinned React/ReactDOM graph. Match that behavior in this
# isolated npm build instead of failing before the Next.js build starts.
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY ${SERVICE_PATH}/ ./

RUN npm run build \
    && npm prune --omit=dev --legacy-peer-deps \
    && addgroup -S zplatform \
    && adduser -S -G zplatform zplatform \
    && chown -R zplatform:zplatform /app

USER zplatform

CMD ["npm", "start"]
