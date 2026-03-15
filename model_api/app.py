import os
import requests
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import torch

app = FastAPI(title="Research Paper Summarizer Model API", version="1.1")

# --- Configuration ---
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")
TEXT_MODEL = os.environ.get("TEXT_MODEL", "mistral")
VISION_MODEL = os.environ.get("VISION_MODEL", "moondream")

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
    Delegates high-level reasoning/generation to Ollama (Mistral).
    """
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": TEXT_MODEL,
                "prompt": request.prompt,
                "stream": False,
                "options": {
                    "num_predict": request.max_length
                }
            }
        )
        response.raise_for_status()
        return {"generated_text": response.json()["response"]}
    except Exception as e:
        print(f"Ollama Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama generation failed: {e}")

@app.post("/vision", response_model=VisionResponse)
def describe_image(request: VisionRequest):
    """
    Uses Ollama's vision capabilities (Moondream) to describe figures.
    """
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": VISION_MODEL,
                "prompt": request.prompt,
                "images": [request.image_base64],
                "stream": False
            }
        )
        response.raise_for_status()
        return {"description": response.json()["response"]}
    except Exception as e:
        print(f"Ollama Vision Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama vision task failed: {e}")

@app.get("/health")
def health_check():
    # Check if Ollama is reachable
    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        ollama_status = "connected"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "device": device,
        "ollama": ollama_status
    }
