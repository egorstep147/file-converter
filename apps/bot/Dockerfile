# IslePlace Converter bot: Python + aiogram, ffmpeg for audio, PyMuPDF/Pillow for PDF and images
FROM python:3.12-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY bot ./bot

# tests run inside the same image in CI: docker build --target test .
FROM base AS test
RUN uv sync --frozen
COPY tests ./tests
RUN uv run pytest -q

FROM base AS runtime
RUN useradd --create-home --uid 10001 bot
USER bot
CMD ["/app/.venv/bin/python", "-m", "bot"]
