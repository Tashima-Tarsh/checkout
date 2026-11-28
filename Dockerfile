FROM node:22-bookworm-slim AS frontend
WORKDIR /ui
COPY checkout/frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY checkout/frontend/ ./
RUN npm run build && test -s dist/index.html

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PDEP_REQUIRE_POSTGRES=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --system checkout
COPY checkout checkout
COPY --from=frontend /ui/dist checkout/frontend/dist
COPY recovery-agent/recovery recovery-agent/recovery
COPY pdep pdep
COPY alembic.ini .
COPY migrations migrations
USER checkout
CMD ["sh", "-ec", "alembic upgrade head; exec uvicorn checkout.server:app --host 0.0.0.0 --port ${PORT:-8080} --no-access-log"]
