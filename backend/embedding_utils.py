import os
import json
import logging
import requests
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Container Hostnames
# `chromadb` will be DNS resolved by docker compose
CHROMADB_HOST = os.environ.get('CHROMADB_HOST', 'chromadb')
CHROMADB_PORT = os.environ.get('CHROMADB_PORT', '8000')
MODEL_API_URL = os.environ.get('MODEL_API_URL', 'http://model_api:8000')

def load_extracted_text(json_path):
    """Loads the extracted text from the JSON file."""
    if not os.path.exists(json_path):
        logger.error(f"Error: {json_path} does not exist.")
        return None
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Combine all pages into a single string for chunking
    # Alternatively we can keep page numbers as metadata
    full_text = ""
    page_mapping = [] # to keep track of which chunk belongs to which page
    
    for page_num, text in data.items():
        if text:
            start_idx = len(full_text)
            full_text += text + "\n"
            end_idx = len(full_text)
            page_mapping.append({"page": page_num, "start": start_idx, "end": end_idx})
            
    return full_text, page_mapping

def chunk_text(text_data, chunk_size=1000, chunk_overlap=200):
    """Chunks the text using Langchain."""
    logger.info(f"Splitting text into chunks (Size: {chunk_size}, Overlap: {chunk_overlap})...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )
    chunks = text_splitter.split_text(text_data)
    logger.info(f"Generated {len(chunks)} chunks.")
    return chunks

def get_embeddings_from_api(chunks):
    """Calls the model_api container to get Specter2 embeddings for chunks."""
    logger.info(f"Requesting embeddings for {len(chunks)} chunks from {MODEL_API_URL}/embed...")
    
    try:
        response = requests.post(f"{MODEL_API_URL}/embed", json={"texts": chunks})
        response.raise_for_status()
        data = response.json()
        return data["embeddings"]
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Model API: {e}", exc_info=True)
        return None

def store_in_chroma(chunks, embeddings, collection_name, metadata=None):
    """Stores chunks and embeddings in ChromaDB via the Chroma HTTP client."""
    logger.info(f"Connecting to ChromaDB at {CHROMADB_HOST}:{CHROMADB_PORT}...")
    try:
        # Use HttpClient to connect to the separate Chroma container
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        
        # Create or Get collection
        collection = client.get_or_create_collection(name=collection_name)
        
        # Prepare data for insertion
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        # If no metadata provided, just create empty dicts
        metadatas = metadata if metadata else [{"source": collection_name} for _ in range(len(chunks))]
        
        logger.info(f"Adding {len(chunks)} documents to collection '{collection_name}'...")
        collection.add(
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        logger.info("Successfully stored chunks in ChromaDB.")
        return True
    except Exception as e:
        logger.error(f"Error interacting with ChromaDB: {e}", exc_info=True)
        return False

def process_and_embed(json_path, collection_name):
    """Master function to orchestrate the embedding process for a single paper."""
    logger.info(f"Starting embedding pipeline for: {json_path}")
    
    # 1. Load Text
    result = load_extracted_text(json_path)
    if not result:
        return False
    full_text, page_mapping = result
    
    # 2. Chunk Text
    chunks = chunk_text(full_text)
    if not chunks:
        logger.warning("No chunks generated.")
        return False
        
    # 3. Get Embeddings
    embeddings = get_embeddings_from_api(chunks)
    if not embeddings:
        logger.error("Failed to get embeddings.")
        return False
        
    # 4. Store in VectorDB
    # Simple metadata tracking the document name
    metadatas = [{"source": collection_name, "chunk_index": i} for i in range(len(chunks))]
    success = store_in_chroma(chunks, embeddings, collection_name, metadatas)
    
    return success

if __name__ == "__main__":
    # Test script for local execution
    # Ensure containers are running first!
    print("Testing embedding utils...")
    import glob
    test_json = glob.glob("../EXTRACT/text/*.json")
    if test_json:
        # e.g Extract the filename "paper1" from "paper1.json" for collection name
        col_name = os.path.splitext(os.path.basename(test_json[0]))[0]
        # For local testing outside docker network, use localhost
        CHROMADB_HOST = "localhost"
        MODEL_API_URL = "http://localhost:8008"
        process_and_embed(test_json[0], col_name)
    else:
        print("No test JSON found in ../EXTRACT/text/")
