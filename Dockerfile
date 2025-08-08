# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose app port
EXPOSE 3001

# Optional healthcheck (expects 200)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/server.js"]


