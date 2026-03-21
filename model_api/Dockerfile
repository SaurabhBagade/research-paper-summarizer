# Use Official PyTorch image with CUDA support
FROM pytorch/pytorch:2.10.0-cuda13.0-cudnn9-runtime

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

# Install dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Add HuggingFace token as a build argument
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}



COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
