import os
import requests
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import torch

app = FastAPI(title="Research Paper Summarizer Model API", version="1.2")

# --- Configuration ---
# OLLAMA_URL points to the Ollama instance on the host machine.
# When running inside Docker, host.docker.internal resolves to the Windows host.
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://host.docker.internal:11434")
TEXT_MODEL = os.environ.get("TEXT_MODEL", "gemma4:e2b")
VISION_MODEL = os.environ.get("VISION_MODEL", "gemma4:e2b")
# Context window size — smaller = smaller KV cache = less VRAM needed.
# 2048 is plenty for RAG prompts and cuts KV cache memory in half vs default 4096.
OLLAMA_NUM_CTX = int(os.environ.get("OLLAMA_NUM_CTX", "2048"))

# --- Model Loading (Embeddings only) ---
device = "cuda" if torch.cuda.is_available() else "cpu"

print("Loading Specter2 Embedding Model...")
# Specter2 is designed for Scientific papers - keep it local for speed and precision
embedder = SentenceTransformer('allenai/specter2_base', device=device)
print("Specter2 Loaded.")

# --- API Data Models ---
class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    embeddings: List[List[float]]

class GenerateRequest(BaseModel):
    prompt: str
    max_length: int = 512

class GenerateResponse(BaseModel):
    generated_text: str

class VisionRequest(BaseModel):
    image_base64: str
    prompt: Optional[str] = "Describe this figure or chart from a research paper in detail for a blind person. Focus on data points, trends, and labels."

class VisionResponse(BaseModel):
    description: str

# --- Endpoints ---
@app.post("/embed", response_model=EmbedResponse)
def get_embeddings(request: EmbedRequest):
    try:
        if not request.texts:
            raise HTTPException(status_code=400, detail="No texts provided.")
        embeddings = embedder.encode(request.texts, show_progress_bar=False)
        return {"embeddings": embeddings.tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
def generate_text(request: GenerateRequest):
    """
    Delegates high-level reasoning/generation to Ollama using the chat API.
    """
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": TEXT_MODEL,
                "messages": [{"role": "user", "content": request.prompt}],
                "stream": False,
                "options": {
                    "num_gpu": 99,
                    "num_ctx": OLLAMA_NUM_CTX,
                }
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        # /api/chat returns: {"message": {"role": "assistant", "content": "..."}}
        generated_text = data.get("message", {}).get("content", "")
        return {"generated_text": generated_text}
    except Exception as e:
        print(f"Ollama Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama generation failed: {e}")

@app.post("/vision", response_model=VisionResponse)
def describe_image(request: VisionRequest):
    """
    Uses Ollama's vision capabilities to describe figures.
    """
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": VISION_MODEL,
                "messages": [{
                    "role": "user",
                    "content": request.prompt,
                    "images": [request.image_base64]
                }],
                "stream": False,
                "options": {
                    "num_gpu": 99,
                    "num_ctx": OLLAMA_NUM_CTX,
                }
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        description = data.get("message", {}).get("content", "")
        return {"description": description}
    except Exception as e:
        print(f"Ollama Vision Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama vision task failed: {e}")

@app.get("/health")
def health_check():
    """Check connectivity to local Ollama and report the active models."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        r.raise_for_status()
        available_models = [m["name"] for m in r.json().get("models", [])]
        ollama_status = "connected"
    except Exception:
        available_models = []
        ollama_status = "disconnected"

    return {
        "status": "healthy",
        "device": device,
        "ollama": ollama_status,
        "ollama_url": OLLAMA_URL,
        "text_model": TEXT_MODEL,
        "vision_model": VISION_MODEL,
        "available_models": available_models,
    }


@app.get("/models")
def list_models():
    """
    Proxies GET /api/tags from the local Ollama instance so callers can
    inspect which models are currently pulled without hitting Ollama directly.
    """
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Ollama: {e}")
