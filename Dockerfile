FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PDEP_REQUIRE_POSTGRES=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --system checkout
COPY checkout checkout
COPY recovery-agent/recovery recovery-agent/recovery
COPY pdep pdep
COPY alembic.ini .
COPY migrations migrations
USER checkout
CMD ["sh", "-ec", "alembic upgrade head; exec uvicorn checkout.server:app --host 0.0.0.0 --port ${PORT:-8080} --no-access-log"]
