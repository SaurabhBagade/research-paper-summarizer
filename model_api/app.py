from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

app = FastAPI(title="Research Paper Summarizer Model API", version="1.0")

# --- Model Loading ---
device = "cuda" if torch.cuda.is_available() else "cpu"

if device == "cuda":
    # User requested exactly 5GB limit in GPU
    limit_bytes = 5 * 1024 * 1024 * 1024
    total_memory = torch.cuda.get_device_properties(0).total_memory
    if limit_bytes < total_memory:
        fraction = limit_bytes / total_memory
        torch.cuda.set_per_process_memory_fraction(fraction, 0)
        print(f"Limiting CUDA memory to 5GB (Fraction: {fraction:.2f} of {total_memory / 1e9:.2f} GB)")

# Note: Specter2 is designed for Scientific papers
print("Loading Specter2 Embedding Model...")
embedder = SentenceTransformer('allenai/specter2_base', device=device)

print("Loading Flan-T5 Generation Model...")
# Use flan-t5-base for reasonable performance/size locally
tokenizer = AutoTokenizer.from_pretrained('google/flan-t5-base')
t5_model = AutoModelForSeq2SeqLM.from_pretrained('google/flan-t5-base').to(device)
print("Models Loaded.")

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

# --- Endpoints ---
@app.post("/embed", response_model=EmbedResponse)
def get_embeddings(request: EmbedRequest):
    """
    Takes a list of text chunks and returns Specter2 embeddings for each.
    """
    try:
        if not request.texts:
            raise HTTPException(status_code=400, detail="No texts provided.")
            
        # Specter models often require specific prefixes like [CLS] but sentence-transformers handles it.
        # Compute embeddings
        embeddings = embedder.encode(request.texts, show_progress_bar=False)
        
        # Convert to list of lists of floats for JSON serialization
        embeddings_list = embeddings.tolist()
        return {"embeddings": embeddings_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
def generate_text(request: GenerateRequest):
    """
    Takes a prompt and uses T5 to generate text. Used for Summarization and Q&A.
    """
    try:
        if not request.prompt:
            raise HTTPException(status_code=400, detail="No prompt provided.")
            
        # Tokenize and generate
        inputs = tokenizer(request.prompt, return_tensors="pt").to(device)
        outputs = t5_model.generate(**inputs, max_length=request.max_length)
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return {"generated_text": generated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy"}
