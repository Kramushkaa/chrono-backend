# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY shared-dto/package*.json ./shared-dto/
COPY shared-dto/tsconfig.json ./shared-dto/
COPY shared-dto/src ./shared-dto/src
RUN npm ci --ignore-scripts
RUN cd shared-dto && npm install && npm run build

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install only prod deps
COPY package*.json ./
COPY shared-dto/package*.json ./shared-dto/
COPY --from=builder /app/shared-dto/dist ./shared-dto/dist
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared-dto/package.json ./shared-dto/package.json

# Expose app port
EXPOSE 3001

# Optional healthcheck (expects 200)
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/server.js"]


