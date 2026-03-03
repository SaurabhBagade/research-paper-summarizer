import os
import shutil
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

from extraction_utils import extract_text, extract_images, extract_tables, extract_text_blocks
from embedding_utils import process_and_embed, get_embeddings_from_api, CHROMADB_HOST, CHROMADB_PORT, MODEL_API_URL
from pydantic import BaseModel
import chromadb
import requests
import db

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
    blocks_json_path = os.path.join(EXTRACT_DIR, 'text', f"{base_name}_blocks.json")
    logger.info(f"[{safe_col_name}] Step 2a: Extracting Text...")
    extract_text(file_path, text_json_path)

    logger.info(f"[{safe_col_name}] Step 2a+: Extracting Text Blocks with Coordinates...")
    extract_text_blocks(file_path, blocks_json_path)

    # Image Extraction
    img_dir_path = os.path.join(EXTRACT_DIR, 'images', f"{base_name}_images")
    logger.info(f"[{safe_col_name}] Step 2b: Extracting Images...")
    extract_images(file_path, img_dir_path)

    # Table Extraction — run with a timeout to avoid pdfplumber hanging on complex PDFs
    table_dir_path = os.path.join(EXTRACT_DIR, 'tables', f"{base_name}_tables")
    logger.info(f"[{safe_col_name}] Step 2c: Extracting Tables (60s timeout)...")
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(extract_tables, file_path, table_dir_path)
            future.result(timeout=60)
    except FutureTimeoutError:
        logger.warning(f"[{safe_col_name}] Table extraction timed out after 60s — skipping tables.")
    except Exception as e:
        logger.warning(f"[{safe_col_name}] Table extraction failed: {e} — skipping tables.")

    # 3. Vectorization (Chunk & Embed) — pass blocks JSON for bbox-aware chunking
    logger.info(f"[{safe_col_name}] Step 3: Chunking and Embedding...")
    success = process_and_embed(text_json_path, safe_col_name, blocks_json_path=blocks_json_path)
    
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
    session_id: str

class SessionCreate(BaseModel):
    id: str
    documentId: str
    documentName: str
    timestamp: int
    messageCount: int = 0
    messages: list = []

@app.post("/sessions")
async def create_new_session(req: SessionCreate):
    session = await db.create_session(
        req.id,
        req.documentId,
        req.documentName,
        req.timestamp
    )
    return session

@app.get("/sessions")
async def get_sessions():
    sessions = await db.get_all_sessions()
    return sessions

@app.get("/sessions/{session_id}")
async def get_session_by_id(session_id: str):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.delete("/sessions/{session_id}")
async def remove_session(session_id: str):
    await db.delete_session(session_id)
    return {"status": "success"}


@app.post("/ask")
async def ask_question(req: AskRequest):
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
        response = requests.post(f"{MODEL_API_URL}/generate", json={"prompt": prompt, "max_length": 256})
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
        for _fname in os.listdir(DATA_DIR):
            if _fname.lower().endswith(".pdf"):
                _safe = ''.join(e for e in os.path.splitext(_fname)[0] if e.isalnum())
                if _safe == req.document_id:
                    _pdf_path = os.path.join(DATA_DIR, _fname)
                    break

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

        return {
            "answer": answer,
            "context_used": context_chunks,
            "context_pages": context_pages,
            "context_highlights": context_highlights,
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during Q&A: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pdf/{document_id}")
def serve_pdf(document_id: str):
    """
    Serves the raw PDF file so the frontend PDF viewer can render it.
    document_id is the safe (alphanumeric) name derived from the filename.
    """
    # Scan data_pdf dir for a file whose sanitised name matches document_id
    for filename in os.listdir(DATA_DIR):
        if filename.lower().endswith(".pdf"):
            safe = ''.join(e for e in os.path.splitext(filename)[0] if e.isalnum())
            if safe == document_id:
                return FileResponse(
                    path=os.path.join(DATA_DIR, filename),
                    media_type="application/pdf",
                    filename=filename,
                )
    raise HTTPException(status_code=404, detail=f"PDF for document '{document_id}' not found.")

@app.get("/health")
def health_check():
    return {"status": "ready"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
