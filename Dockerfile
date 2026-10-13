# ==============================================================================
# Multi-Stage Dockerfile for Mirana AI Fullstack Deployment on Render
# ==============================================================================

# ── Stage 1: Build Frontend (Vite + React) ────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency manifests
COPY frontend/package*.json ./
RUN npm ci || npm install

# Copy frontend source code
COPY frontend/ ./

# Optional build arg for custom API URL (defaults to empty so frontend calls same origin)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build production assets into /app/frontend/dist
RUN npm run build

# ── Stage 2: Production Backend & Static File Server ──────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Ensure production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for the backend
COPY backend/package*.json ./backend/
RUN cd backend && (npm ci --omit=dev || npm install --omit=dev)

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Render automatically sets PORT at runtime (typically 10000)
EXPOSE 5000

WORKDIR /app/backend

# Start Mirana API & SPA Server
CMD ["node", "server.js"]
