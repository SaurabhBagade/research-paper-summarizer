import os
import shutil
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from extraction_utils import extract_text, extract_images, extract_tables
from embedding_utils import process_and_embed, get_embeddings_from_api, CHROMADB_HOST, CHROMADB_PORT, MODEL_API_URL
from pydantic import BaseModel
import chromadb
import requests
# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Research Paper Summarizer API")

# Allow requests from a frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration Setup
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_pdf')
EXTRACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'EXTRACT')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(EXTRACT_DIR, 'text'), exist_ok=True)
os.makedirs(os.path.join(EXTRACT_DIR, 'images'), exist_ok=True)
os.makedirs(os.path.join(EXTRACT_DIR, 'tables'), exist_ok=True)

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Endpoint to receive a PDF, save it, and trigger the extraction & embedding pipeline.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # 1. Save the file locally
    file_path = os.path.join(DATA_DIR, file.filename)
    logger.info(f"Receiving upload: {file.filename}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Successfully saved file to {file_path}")
    except Exception as e:
        logger.error(f"Failed to save file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # 2. Extract Data
    base_name = os.path.splitext(file.filename)[0]
    safe_col_name = ''.join(e for e in base_name if e.isalnum())
    logger.info(f"Starting extraction for document ID: {safe_col_name}")
    
    # Text Extraction
    text_json_path = os.path.join(EXTRACT_DIR, 'text', f"{base_name}.json")
    logger.info(f"[{safe_col_name}] Step 2a: Extracting Text...")
    extract_text(file_path, text_json_path)

    # Image Extraction
    img_dir_path = os.path.join(EXTRACT_DIR, 'images', f"{base_name}_images")
    logger.info(f"[{safe_col_name}] Step 2b: Extracting Images...")
    extract_images(file_path, img_dir_path)

    # Table Extraction
    table_dir_path = os.path.join(EXTRACT_DIR, 'tables', f"{base_name}_tables")
    logger.info(f"[{safe_col_name}] Step 2c: Extracting Tables...")
    extract_tables(file_path, table_dir_path)

    # 3. Vectorization (Chunk & Embed)
    logger.info(f"[{safe_col_name}] Step 3: Chunking and Embedding...")
    success = process_and_embed(text_json_path, safe_col_name)
    
    if not success:
        logger.error(f"[{safe_col_name}] Pipeline failed during embedding phase.")
        return {"status": "partial_success", "message": "Extraction succeeded, but embedding failed. Check backend logs.", "document_id": safe_col_name}

    logger.info(f"[{safe_col_name}] Pipeline completed successfully.")

    return {
        "status": "success", 
        "message": f"{file.filename} processed and embedded successfully.",
        "document_id": safe_col_name
    }

class AskRequest(BaseModel):
    query: str
    document_id: str

@app.post("/ask")
def ask_question(req: AskRequest):
    """
    RAG Endpoint: 
    1. Embeds the user query.
    2. Searches ChromaDB for relevant context.
    3. Sends the context + query to FLAN-T5 for an answer.
    """
    try:
        # 1. Embed the Question
        logger.info(f"Embedding query: '{req.query}'")
        query_embedding = get_embeddings_from_api([req.query])
        if not query_embedding:
            raise HTTPException(status_code=500, detail="Failed to embed query using model_api")

        # 2. Search Vector DB for context
        logger.info(f"Querying ChromaDB collection '{req.document_id}'...")
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        try:
            collection = client.get_collection(name=req.document_id)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Document ID '{req.document_id}' not found in database. Did you upload it?")

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=3 # Get top 3 most relevant chunks
        )
        
        # 3. Compile Context
        if not results['documents'] or not results['documents'][0]:
            return {"answer": "I could not find relevant information in the document to answer your question.", "context": []}
            
        context_chunks = results['documents'][0]
        context_text = "\n\n".join(context_chunks)
        
        # 4. Generate Answer using FLAN-T5
        prompt = f"Based on the following extracted context from a research paper, answer the question.\n\nContext:\n{context_text}\n\nQuestion: {req.query}\n\nAnswer:"
        
        logger.info("Sending prompt to model_api /generate...")
        response = requests.post(f"{MODEL_API_URL}/generate", json={"prompt": prompt, "max_length": 256})
        response.raise_for_status()
        
        answer = response.json().get("generated_text", "Failed to generate text.")
        
        return {
            "answer": answer,
            "context_used": context_chunks
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during Q&A: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ready"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
