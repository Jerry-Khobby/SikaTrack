# syntax=docker/dockerfile:1
# Build from the repository root (the API shares the pipeline's code in data-engineering/):
#   docker build -f backend/Dockerfile .
# What may enter the build is whitelisted in backend/Dockerfile.dockerignore.

# ---- build: wheels for the API, the shared pipeline code and their dependencies ----
FROM python:3.11-slim AS build
WORKDIR /src
COPY data-engineering/pyproject.toml pipeline/
COPY data-engineering/src pipeline/src
COPY backend/pyproject.toml backend/README.md api/
COPY backend/src api/src
RUN pip wheel --no-cache-dir --wheel-dir /wheels ./pipeline ./api

# ---- runtime: only the installed wheels, run as a non-root user ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin api
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-index --find-links=/wheels sikatrack-api && rm -rf /wheels
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic

USER api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)"]
# --proxy-headers: the client address comes from the proxy's X-Forwarded-For, trusted only from
# FORWARDED_ALLOW_IPS (default 127.0.0.1; docker-compose sets it for the proxy's network)
CMD ["uvicorn", "sikatrack_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", \
     "--no-server-header", "--proxy-headers"]
