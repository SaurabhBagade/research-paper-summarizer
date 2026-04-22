import os
import shutil
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import re
import requests
import db
import init_db
from pydantic import BaseModel
from worker import process_pdf_task, celery_app
from embedding_utils import get_embeddings_from_api, MODEL_API_URL

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Research Paper Summarizer API")

@app.on_event("startup")
async def startup_event():
    """Initialize database tables and extensions on boot."""
    logger.info("Initializing database...")
    await init_db.init_db()
    
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

# Tunable settings (can be overridden via environment variables)
# How many top chunks to retrieve from Chroma for RAG context
MAX_CONTEXT_CHUNKS = int(os.environ.get('MAX_CONTEXT_CHUNKS', '5'))
# How many tokens we ask the generation model to produce
MAX_GENERATE_TOKENS = int(os.environ.get('MAX_GENERATE_TOKENS', '512'))
# How permissive to be when returning related images (higher returns more images)
IMAGE_DISTANCE_THRESHOLD = float(os.environ.get('IMAGE_DISTANCE_THRESHOLD', '1.8'))

@app.post("/api/notebooks")
async def create_notebook(req: dict):
    title = req.get("title", "New Notebook")
    description = req.get("description", "")
    color = req.get("color", "#3B82F6")
    nb = await db.create_notebook(title, description, color)
    return {"status": "success", "notebook": nb}

@app.get("/api/notebooks")
async def get_notebooks():
    nbs = await db.get_notebooks()
    return {"notebooks": nbs}

@app.get("/api/notebooks/{notebook_id}")
async def get_notebook(notebook_id: str):
    nb = await db.get_notebook(notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"notebook": nb}

@app.get("/api/notebooks/{notebook_id}/sources")
async def get_notebook_sources(notebook_id: str):
    sources = await db.get_sources(notebook_id)
    return {"sources": sources}

def sanitize_document_id(name: str) -> str:
    """
    Sanitize document IDs so we can consistently use them for collection names,
    folders, and lookups. Replaces non-alphanumeric with underscores.
    """
    sanitized = re.sub(r'[^0-9A-Za-z]+', '_', name).strip('_')
    return sanitized or 'document'

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), notebook_id: str = Form(None)):
    """
    Endpoint to receive a PDF, save it, and trigger the extraction & embedding pipeline.
    Optionally tie it to a notebook.
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

    # 2. Extract Data via Celery worker
    base_name = os.path.splitext(file.filename)[0]
    safe_col_name = sanitize_document_id(base_name)

    # Save mapping of sanitized ID to original filename immediately so frontend knows it exists
    await db.save_document_metadata(safe_col_name, file.filename)
    logger.info(f"Dispatching Celery task for document ID: {safe_col_name} to Notebook: {notebook_id}")

    task = process_pdf_task.delay(safe_col_name, file.filename, notebook_id)

    return {
        "status": "success", 
        "message": f"{file.filename} is processing in the background.",
        "document_id": safe_col_name,
        "notebook_id": notebook_id,
        "task_id": task.id
    }

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    task_result = celery_app.AsyncResult(task_id)
    result = {
        "task_id": task_id,
        "task_status": task_result.status,
        "task_result": task_result.result if task_result.status == 'SUCCESS' else None
    }
    return result

class AskRequest(BaseModel):
    query: str
    document_id: str | None = None
    notebook_id: str | None = None
    session_id: str | None = None

class SessionCreate(BaseModel):
    id: str
    documentId: str
    documentName: str
    timestamp: int
    messageCount: int = 0
    messages: list = []

@app.post("/api/sessions")
async def create_new_session(req: SessionCreate):
    session = await db.create_session(
        req.id,
        req.documentId,
        req.documentName,
        req.timestamp
    )
    return session

@app.get("/api/sessions")
async def get_sessions():
    sessions = await db.get_all_sessions()
    return sessions

@app.get("/api/sessions/{session_id}")
async def get_session_by_id(session_id: str):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.delete("/api/sessions/{session_id}")
async def remove_session(session_id: str):
    await db.delete_session(session_id)
    return {"status": "success"}


@app.post("/api/ask")
async def ask_question(req: AskRequest):
    """
    RAG Endpoint: 
    1. Embeds the user query.
    2. Searches ChromaDB for relevant context.
    3. Sends the context + query to Ollama (Mistral) for an answer.
    """
    try:
        # 1. Embed the Question
        logger.info(f"Embedding query: '{req.query}'")
        query_embedding = get_embeddings_from_api([req.query])
        if not query_embedding:
            raise HTTPException(status_code=500, detail="Failed to embed query using model_api")

        # 2. Search Vector DB for context
        if req.notebook_id:
            logger.info(f"Hybrid querying PostgreSQL PgVector for Notebook '{req.notebook_id}'...")
            results = await db.hybrid_search_notebook(req.notebook_id, req.query, query_embedding[0], limit=MAX_CONTEXT_CHUNKS)
        else:
            logger.info(f"Querying PostgreSQL PgVector for Document '{req.document_id}'...")
            results = await db.search_document_chunks(req.document_id, query_embedding[0], limit=MAX_CONTEXT_CHUNKS)
        
        # 3. Compile Context
        if not results['documents'] or not results['documents'][0]:
            return {"answer": "I could not find relevant information in the document to answer your question.", "context": []}
            
        context_chunks = results['documents'][0]
        # Extract page numbers from chunk metadata for the highlight feature
        context_metadata = results.get('metadatas', [[]])[0]  # list of metadata dicts
        context_pages = list(dict.fromkeys(
            m.get('page_num', 1) for m in context_metadata if m
        ))  # deduplicated, ordered page numbers
        context_text = "\n\n".join(context_chunks)
        
        # 4. Fetch last 6 messages (3 turns) from session history to give model context
        HISTORY_TURNS = 3
        history_text = ""
        session = await db.get_session(req.session_id)
        if session and session.get("messages"):
            recent_messages = session["messages"][-(HISTORY_TURNS * 2):]  # last N turns = N*2 messages
            history_lines = []
            for msg in recent_messages:
                role = "User" if msg.get("type") == "user" else "Assistant"
                history_lines.append(f"{role}: {msg.get('content', '')}")
            history_text = "\n".join(history_lines)
            logger.info(f"Injecting {len(recent_messages)} history messages into prompt.")
        
        # 5. Build the prompt — include history only if it exists
        if history_text:
            prompt = (
                f"You are a helpful research assistant. Use the provided paper context to answer the question.\n\n"
                f"Paper Context:\n{context_text}\n\n"
                f"Conversation so far:\n{history_text}\n\n"
                f"User: {req.query}\nAssistant:"
            )
        else:
            prompt = (
                f"You are a helpful research assistant. Use the provided paper context to answer the question.\n\n"
                f"Paper Context:\n{context_text}\n\n"
                f"User: {req.query}\nAssistant:"
            )
        
        logger.info("Sending prompt to model_api /generate...")
        response = requests.post(
            f"{MODEL_API_URL}/generate",
            json={"prompt": prompt, "max_length": MAX_GENERATE_TOKENS},
        )
        response.raise_for_status()
        
        answer = response.json().get("generated_text", "Failed to generate text.")
        
        # Save messages to database
        user_msg = {"id": str(len(context_chunks) + req.query.__hash__()), "type": "user", "content": req.query}
        assistant_msg = {"id": str(len(context_chunks) + answer.__hash__()), "type": "assistant", "content": answer, "context": context_chunks}
        
        # We need to map role back to 'type' since frontend uses type: 'user' | 'assistant'
        await db.add_messages_to_session(req.session_id, [user_msg, assistant_msg])

        # Sentence-level highlighting: split each context chunk into sentences,
        # search for each in the PDF page → get one rect per matching line (marker effect).
        # Falls back to stored union bbox if the PDF cannot be opened.
        import re, fitz as _fitz

        context_highlights = []
        _pdf_path = None
        
        # Look up original filename from metadata
        _doc_meta = await db.get_document_metadata(req.document_id)
        if _doc_meta and _doc_meta.get("filename"):
            _pdf_path = os.path.join(DATA_DIR, _doc_meta["filename"])

        if _pdf_path:
            try:
                _doc = _fitz.open(_pdf_path)
                for chunk_text, meta in zip(context_chunks, context_metadata):
                    if not meta:
                        continue
                    page_num = meta.get('page_num', 1)
                    page = _doc[page_num - 1]
                    page_width = page.rect.width
                    page_height = page.rect.height

                    # Split chunk into sentences; search each ≥5-word sentence
                    sentences = re.split(r'(?<=[.!?])\s+', chunk_text)
                    all_rects = []
                    for sent in sentences:
                        sent = sent.strip()
                        if len(sent.split()) < 5:
                            continue
                        for r in page.search_for(sent):
                            all_rects.append([r.x0, r.y0, r.x1, r.y1])

                    if all_rects:
                        context_highlights.append({
                            "page": page_num,
                            "rects": all_rects,
                            "page_width": page_width,
                            "page_height": page_height,
                        })
                    else:
                        # Fallback: use stored union bbox
                        bbox_x1 = meta.get('bbox_x1', 0)
                        bbox_y1 = meta.get('bbox_y1', 0)
                        if bbox_x1 > 0 and bbox_y1 > 0:
                            context_highlights.append({
                                "page": page_num,
                                "rects": [[meta['bbox_x0'], meta['bbox_y0'], bbox_x1, bbox_y1]],
                                "page_width": page_width,
                                "page_height": page_height,
                            })
                _doc.close()
            except Exception as _e:
                logger.warning(f"Sentence-level highlight extraction failed: {_e}")

        # 4c. Query image collection skipped for pure PostgreSQL setup (Deferred)
        relevant_images = []

        return {
            "answer": answer,
            "context_used": context_chunks,
            "context_pages": context_pages,
            "context_highlights": context_highlights,
            "relevant_images": relevant_images,
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during Q&A: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/{document_id}/{filename}")
def serve_image(document_id: str, filename: str):
    """
    Serves an extracted figure image file so the frontend can display it.
    Uses the sanitized document_id directly to locate the directory.
    """
    img_path = os.path.join(EXTRACT_DIR, 'images', f"{document_id}_images", filename)
    if os.path.exists(img_path):
        return FileResponse(path=img_path)
    
    # Fallback to scanning if it's an old document before the standardized naming
    for base_name in os.listdir(os.path.join(EXTRACT_DIR, 'images')):
        safe = sanitize_document_id(base_name.replace('_images', ''))
        if safe == document_id:
            old_path = os.path.join(EXTRACT_DIR, 'images', base_name, filename)
            if os.path.exists(old_path):
                return FileResponse(path=old_path)
                
    raise HTTPException(status_code=404, detail=f"Image '{filename}' not found for document '{document_id}'.")


@app.get("/api/pdf/{document_id}")
async def serve_pdf(document_id: str):
    """
    Serves the raw PDF file so the frontend PDF viewer can render it.
    Uses database metadata to find the original filename.
    """
    doc_meta = await db.get_document_metadata(document_id)
    if not doc_meta or not doc_meta.get("filename"):
        # Fallback to scanning for older documents
        for filename in os.listdir(DATA_DIR):
            if filename.lower().endswith(".pdf"):
                if sanitize_document_id(os.path.splitext(filename)[0]) == document_id:
                    return FileResponse(
                        path=os.path.join(DATA_DIR, filename),
                        media_type="application/pdf",
                        filename=filename,
                    )
        raise HTTPException(status_code=404, detail=f"PDF for document '{document_id}' not found.")

    file_path = os.path.join(DATA_DIR, doc_meta["filename"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"PDF file '{doc_meta['filename']}' not found on disk.")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=doc_meta["filename"],
    )

@app.get("/api/health")
def health_check():
    return {"status": "ready"}

@app.get("/api/search")
async def keyword_search(notebook_id: str, q: str, limit: int = 10):
    """Explicit endpoint for Full-Text keyword queries across a Notebook constraint."""
    if not q or not notebook_id:
        raise HTTPException(status_code=400, detail="Missing query or notebook_id")
    logger.info(f"Executing GIN exact search on notebook '{notebook_id}' for query '{q}'")
    results = await db.exact_keyword_search(notebook_id, q, limit=limit)
    return results

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
