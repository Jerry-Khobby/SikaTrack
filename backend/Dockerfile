# syntax=docker/dockerfile:1

# ---- build: compile wheels for the app and its dependencies ----
FROM python:3.11-slim AS build
WORKDIR /src
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip wheel --no-cache-dir --wheel-dir /wheels .

# ---- runtime: only the installed wheels, run as a non-root user ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin api
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-index --find-links=/wheels sikatrack-api && rm -rf /wheels
COPY alembic.ini ./
COPY alembic ./alembic

USER api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)"]
CMD ["uvicorn", "sikatrack_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
