import os
import json
import logging
import requests
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CHROMADB_HOST = os.environ.get('CHROMADB_HOST', 'chromadb')
CHROMADB_PORT = os.environ.get('CHROMADB_PORT', '8000')
MODEL_API_URL = os.environ.get('MODEL_API_URL', 'http://model_api:8000')


# ── Block-level loading (preferred — has bbox coords) ──────────────────────────

def load_text_blocks(blocks_json_path):
    """
    Load per-page block data saved by extract_text_blocks().
    Returns list of page dicts: {page_num, page_width, page_height, blocks:[{text, bbox}]}
    """
    with open(blocks_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    pages = []
    for page_num_str, page_data in data.items():
        pages.append({
            "page_num": int(page_num_str),
            "page_width": page_data["page_width"],
            "page_height": page_data["page_height"],
            "blocks": page_data.get("blocks", []),
        })
    logger.info(f"Loaded {len(pages)} pages with block data from {blocks_json_path}")
    return pages


def chunk_blocks(pages_data, chunk_size=800, chunk_overlap=150):
    """
    Chunks text block-by-block per page.
    Each chunk tracks the UNION bounding box of all blocks it contains,
    enabling full section highlighting in the PDF viewer.

    Returns list of:
    {text, page_num, bbox: [x0,y0,x1,y1], page_width, page_height}
    """
    result = []

    for page_data in pages_data:
        page_num = page_data["page_num"]
        page_width = page_data["page_width"]
        page_height = page_data["page_height"]
        blocks = page_data["blocks"]

        if not blocks:
            continue

        current_text = ""
        current_bboxes = []

        for block in blocks:
            block_text = block["text"]
            block_bbox = block["bbox"]

            # If adding this block would exceed chunk_size, flush the current chunk
            if len(current_text) + len(block_text) > chunk_size and current_text:
                union_bbox = _union_bbox(current_bboxes)
                result.append({
                    "text": current_text.strip(),
                    "page_num": page_num,
                    "bbox": union_bbox,
                    "page_width": page_width,
                    "page_height": page_height,
                })
                # Overlap: carry last block into next chunk
                current_text = block_text + "\n"
                current_bboxes = [block_bbox]
            else:
                current_text += block_text + "\n"
                current_bboxes.append(block_bbox)

        # Flush the last chunk on this page
        if current_text.strip():
            result.append({
                "text": current_text.strip(),
                "page_num": page_num,
                "bbox": _union_bbox(current_bboxes),
                "page_width": page_width,
                "page_height": page_height,
            })

    logger.info(f"Generated {len(result)} chunks with bbox data.")
    return result


def _union_bbox(bboxes):
    """Compute the bounding rectangle that contains all the given bboxes."""
    if not bboxes:
        return [0, 0, 0, 0]
    return [
        min(b[0] for b in bboxes),
        min(b[1] for b in bboxes),
        max(b[2] for b in bboxes),
        max(b[3] for b in bboxes),
    ]


# ── Fallback: page-level text loading (no bbox) ────────────────────────────────

def load_extracted_text(json_path):
    """Fallback loader when no block JSON is available."""
    if not os.path.exists(json_path):
        logger.error(f"Error: {json_path} does not exist.")
        return None
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    pages = []
    for page_num_str, text in data.items():
        if text and text.strip():
            pages.append({"page_num": int(page_num_str), "text": text})
    return pages


def chunk_page(page_text, page_num, chunk_size=800, chunk_overlap=150):
    """Fallback chunker — no bbox data."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )
    return [{"text": c, "page_num": page_num, "bbox": None} for c in splitter.split_text(page_text)]


# ── Shared utilities ───────────────────────────────────────────────────────────

def get_embeddings_from_api(chunks):
    """Calls the model_api container to get Specter2 embeddings for chunks."""
    logger.info(f"Requesting embeddings for {len(chunks)} chunks from {MODEL_API_URL}/embed...")
    try:
        response = requests.post(f"{MODEL_API_URL}/embed", json={"texts": chunks})
        response.raise_for_status()
        return response.json()["embeddings"]
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Model API: {e}", exc_info=True)
        return None


def store_in_chroma(chunks, embeddings, collection_name, metadatas):
    """Stores chunks and embeddings in ChromaDB. Recreates collection on re-upload."""
    logger.info(f"Connecting to ChromaDB at {CHROMADB_HOST}:{CHROMADB_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        try:
            client.delete_collection(name=collection_name)
        except Exception:
            pass
        collection = client.get_or_create_collection(name=collection_name)
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        logger.info(f"Adding {len(chunks)} documents to collection '{collection_name}'...")
        collection.add(embeddings=embeddings, documents=chunks, metadatas=metadatas, ids=ids)
        logger.info("Successfully stored chunks in ChromaDB.")
        return True
    except Exception as e:
        logger.error(f"Error interacting with ChromaDB: {e}", exc_info=True)
        return False


def process_and_embed(json_path, collection_name, blocks_json_path=None):
    """
    Master pipeline: load → chunk (with bbox if blocks available) → embed → store.
    If blocks_json_path is provided and exists, uses block-level chunking with full
    section bbox coordinates stored per chunk. Falls back to page-level text chunking.
    """
    logger.info(f"Starting embedding pipeline for: {json_path}")

    # Prefer block-level data (has bbox coords for highlighting)
    if blocks_json_path and os.path.exists(blocks_json_path):
        logger.info("Using block-level chunking with bbox coordinates.")
        pages_data = load_text_blocks(blocks_json_path)
        tagged_chunks = chunk_blocks(pages_data)
    else:
        logger.info("Block JSON not found — falling back to page-level text chunking.")
        pages = load_extracted_text(json_path)
        if not pages:
            return False
        tagged_chunks = []
        for page in pages:
            tagged_chunks.extend(chunk_page(page["text"], page["page_num"]))

    if not tagged_chunks:
        logger.warning("No chunks generated.")
        return False

    texts = [c["text"] for c in tagged_chunks]
    embeddings = get_embeddings_from_api(texts)
    if not embeddings:
        logger.error("Failed to get embeddings.")
        return False

    # Build metadata — bbox fields stored as flat numbers (ChromaDB requires scalar values)
    metadatas = []
    for i, c in enumerate(tagged_chunks):
        bbox = c.get("bbox") or [0, 0, 0, 0]
        metadatas.append({
            "source": collection_name,
            "page_num": c["page_num"],
            "chunk_index": i,
            "bbox_x0": bbox[0],
            "bbox_y0": bbox[1],
            "bbox_x1": bbox[2],
            "bbox_y1": bbox[3],
            "page_width": c.get("page_width", 0),
            "page_height": c.get("page_height", 0),
        })

    return store_in_chroma(texts, embeddings, collection_name, metadatas)


if __name__ == "__main__":
    import glob
    test_json = glob.glob("../EXTRACT/text/*.json")
    if test_json:
        col_name = os.path.splitext(os.path.basename(test_json[0]))[0]
        CHROMADB_HOST = "localhost"
        MODEL_API_URL = "http://localhost:8008"
        blocks_json = test_json[0].replace(".json", "_blocks.json")
        process_and_embed(test_json[0], col_name, blocks_json_path=blocks_json if os.path.exists(blocks_json) else None)
    else:
        print("No test JSON found in ../EXTRACT/text/")
