FROM python:3.9-slim-buster

WORKDIR /app

COPY backend/ backend/

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH=/app

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "backend.app:app"]