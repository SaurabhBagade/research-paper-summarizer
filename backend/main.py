import os
import shutil
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from extraction_utils import extract_text, extract_images, extract_tables
from embedding_utils import process_and_embed
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

@app.get("/health")
def health_check():
    return {"status": "ready"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
