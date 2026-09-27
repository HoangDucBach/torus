# Build from the repo root — the server needs contracts/deployments/<chainId>.json, which lives
# outside server/:
#   docker build -f server/Dockerfile -t torus-server .
#   docker run -p 8787:8787 --env-file server/.env --env-file server/.env.production torus-server

FROM oven/bun:1.3-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3-alpine
WORKDIR /app
COPY contracts/deployments ./contracts/deployments
COPY server ./server
COPY --from=deps /app/server/node_modules ./server/node_modules

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 8787
CMD ["bun", "run", "src/index.ts"]
