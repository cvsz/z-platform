FROM node:20-alpine

ARG SERVICE_PATH
ENV NODE_ENV=production
ENV HOST=0.0.0.0

WORKDIR /app

COPY ${SERVICE_PATH}/package.json ./package.json
COPY ${SERVICE_PATH}/ ./

RUN addgroup -S zplatform && adduser -S -G zplatform zplatform \
    && chown -R zplatform:zplatform /app

USER zplatform

CMD ["npm", "start"]
