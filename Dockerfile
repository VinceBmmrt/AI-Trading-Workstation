# Stage 1: Node builder — compile Next.js static export
FROM node:20-slim AS node-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime — FastAPI served by uvicorn
FROM python:3.12-slim AS runtime

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install backend dependencies
COPY backend/ ./backend/
RUN cd backend && uv sync --no-dev

# Copy the Next.js static export (served by FastAPI at runtime)
COPY --from=node-builder /build/frontend/out ./frontend/out/

# Ensure db directory exists for the volume mount point
RUN mkdir -p /app/db

EXPOSE 8000

WORKDIR /app/backend
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
