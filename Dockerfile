# meetup-lite runs entirely as one process in one container: the Node HTTP
# server, the Discord bot's interaction handling, and a SQLite database file
# on a mounted volume. No other services required.
#
# node:22-slim (Debian, not Alpine) is used deliberately: Node's official
# Alpine builds have occasionally shipped without full ICU data, and this
# app's timezone handling (Intl.DateTimeFormat with arbitrary IANA zones)
# depends on that being correct. node:sqlite is bundled into Node itself,
# so there's no native module to compile either way — slim costs a little
# image size for a lot of confidence.
FROM node:22-slim

WORKDIR /app

# No package.json / npm install step on purpose: zero runtime dependencies.
COPY server.js ./
COPY src ./src

# Where the SQLite database file lives — mount a volume here to persist data
# across container restarts/redeploys.
ENV DB_PATH=/data/data.db
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

ENV PORT=3000
EXPOSE 3000

USER node

CMD ["node", "server.js"]
