# ==============================================================================
# Multi-Stage Production Dockerfile for Caffe Platform
# Built for ultra-fast, deterministic deployments & high-scale commercial usage
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the Static Application & SSR Prerendered Routes
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for multi-client white-label customization
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_RESTAURANT_ID
ARG VITE_SITE_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_RESTAURANT_ID=$VITE_RESTAURANT_ID
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV NODE_ENV=production

# Copy package manifests for efficient Docker layer caching
COPY the-cafe-barrackpore/package*.json ./the-cafe-barrackpore/
COPY package*.json ./

# Install workspace dependencies cleanly
RUN npm ci --workspace=the-cafe-barrackpore

# Copy application source code
COPY the-cafe-barrackpore/ ./the-cafe-barrackpore/

# Build static assets with full TypeScript checking, bundling & SSG prerendering
WORKDIR /app/the-cafe-barrackpore
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Static Delivery Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine-slim AS runner

# Remove default nginx welcome files
RUN rm -rf /usr/share/nginx/html/*

# Copy pre-rendered static files and SPA bundles from builder stage
COPY --from=builder /app/the-cafe-barrackpore/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck for orchestration (Docker Compose, Kubernetes, AWS ECS, Traefik)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/healthz || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
