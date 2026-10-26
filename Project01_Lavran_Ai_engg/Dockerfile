# Serving image: onnxruntime only (no torch), non-root, secrets via environment at run time.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/src
WORKDIR /app
COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt
COPY src ./src
COPY configs ./configs
COPY models/dagu_int8.onnx models/threshold.json ./models/
COPY static ./static
RUN useradd -m app && mkdir -p logs && chown -R app /app
USER app
EXPOSE 8000
# run with:  docker run -e DAGU_API_KEY=... -p 8000:8000 dagu
CMD ["sh", "-c", "uvicorn dagu.api:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}"]
