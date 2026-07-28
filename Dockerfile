# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy static assets
COPY assets/ ./assets/
COPY config/ ./config/

# Create required directories
RUN mkdir -p storage/sessions storage/media storage/backups logs

# Non-root user for security
RUN addgroup -S pappy && adduser -S pappy -G pappy
RUN chown -R pappy:pappy /app
USER pappy

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/core/Bootstrap.js"]
