# Glama / directory listing image for rpcedge-mcp (stdio MCP).
# Must start and answer tools/list without a paid key (public mainnet demo path).
# Build: docker build -t rpcedge-mcp .
# Run:   docker run -i --rm -e RPCEDGE_KEY rpcedge-mcp

FROM node:22-alpine

LABEL org.opencontainers.image.title="rpcedge-mcp"
LABEL org.opencontainers.image.description="MCP server for rpc edge Solana infrastructure"
LABEL org.opencontainers.image.source="https://github.com/rpc-edge/rpcedge-toolkit"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install published packages (workspace deps resolve on npm as ^0.1.2).
# Prefer a pin that matches the monorepo release; bump when publishing.
RUN npm install --omit=dev rpcedge-mcp@0.1.2 \
  && npm cache clean --force

# Optional at runtime: -e RPCEDGE_KEY=... from https://app.rpcedge.com/signup
# Without a key, introspection still works; doctor falls back to public mainnet demo path.
ENV NODE_ENV=production

# stdio MCP - do not allocate a TTY; clients attach stdin/stdout
ENTRYPOINT ["npx", "--no-install", "rpcedge-mcp"]
