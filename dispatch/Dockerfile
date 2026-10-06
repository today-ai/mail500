FROM node:24-bookworm-slim
WORKDIR /app
COPY email-marketing.html /app/email-marketing.html
COPY dispatch /app/dispatch
RUN mkdir -p /app/dispatch/data && chown -R node:node /app
USER node
WORKDIR /app/dispatch
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3080 DATABASE_PATH=/app/dispatch/data/dispatch.sqlite
EXPOSE 3080
CMD ["node", "server.mjs"]
