FROM oven/bun:1.3.14 AS builder
WORKDIR /home/bun/app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build

FROM builder AS prod-deps
RUN bun install --production --frozen-lockfile

FROM oven/bun:1.3.14-slim AS runner
WORKDIR /home/bun/app
ENV NODE_ENV=production
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates gosu && \
    wget -O /tmp/geoipupdate.deb https://github.com/maxmind/geoipupdate/releases/download/v7.1.1/geoipupdate_7.1.1_linux_amd64.deb && \
    dpkg -i /tmp/geoipupdate.deb && \
    rm /tmp/geoipupdate.deb && \
    apt-get remove -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /usr/share/GeoIP && \
    chown bun:bun /usr/share/GeoIP

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER bun
COPY --chown=bun:bun --chmod=555 --from=builder /home/bun/app/dist ./dist
COPY --chown=bun:bun --chmod=555 --from=prod-deps /home/bun/app/node_modules ./node_modules

EXPOSE 3000
USER root
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]
