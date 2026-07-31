# Package-scoped image (same runtime as repo root Dockerfile).
# Prefer building from monorepo root: docker build -t rpcedge-mcp .

FROM node:22-alpine
WORKDIR /app
RUN npm install --omit=dev rpcedge-mcp@0.1.2 && npm cache clean --force
ENV NODE_ENV=production
ENTRYPOINT ["npx", "--no-install", "rpcedge-mcp"]
