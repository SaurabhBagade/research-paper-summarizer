import os
import json
import logging
import requests
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
    Each chunk is composed of **complete sentences** — never split mid-sentence.
    Each sentence inherits the bbox of its parent text block.
    The chunk's stored bbox = union of all sentence bboxes in the chunk.

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

        # Flatten blocks into (sentence, bbox) pairs
        sentence_units = []
        for block in blocks:
            block_bbox = block["bbox"]
            for sent in _split_sentences(block["text"]):
                if sent.strip():
                    sentence_units.append((sent.strip(), block_bbox))

        if not sentence_units:
            continue

        current_sents = []
        current_bboxes = []
        current_len = 0

        for sent, bbox in sentence_units:
            sent_len = len(sent)

            # Flush when adding this sentence would exceed chunk_size
            # (always allow at least one sentence per chunk)
            if current_len + sent_len > chunk_size and current_sents:
                result.append({
                    "text": " ".join(current_sents),
                    "page_num": page_num,
                    "bbox": _union_bbox(current_bboxes),
                    "page_width": page_width,
                    "page_height": page_height,
                })
                # Overlap: carry last sentence into next chunk
                current_sents = [current_sents[-1]] if current_sents else []
                current_bboxes = [current_bboxes[-1]] if current_bboxes else []
                current_len = len(current_sents[0]) if current_sents else 0

            current_sents.append(sent)
            current_bboxes.append(bbox)
            current_len += sent_len + 1  # +1 for the space

        # Flush remaining sentences on this page
        if current_sents:
            result.append({
                "text": " ".join(current_sents),
                "page_num": page_num,
                "bbox": _union_bbox(current_bboxes),
                "page_width": page_width,
                "page_height": page_height,
            })

    logger.info(f"Generated {len(result)} sentence-boundary chunks with bbox data.")
    return result


def _split_sentences(text):
    """
    Split text into sentences using NLTK's Punkt tokenizer.
    Much more accurate than regex for academic text — handles citations like [1].,
    abbreviations, formulas with periods, and lowercase sentence continuations.
    """
    import nltk
    # Download Punkt data silently on first use
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        nltk.download('punkt_tab', quiet=True)
    return nltk.sent_tokenize(text)

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


def embed_image_captions(image_index_path, collection_name):
    """
    Reads the image index JSON produced by extract_image_index(), embeds each figure
    caption, and stores them in a separate ChromaDB collection ({collection_name}_images).
    At query time, this collection is searched to find images relevant to the question.
    """
    if not os.path.exists(image_index_path):
        logger.warning(f"Image index not found: {image_index_path} — skipping image embedding.")
        return False

    with open(image_index_path, "r", encoding="utf-8") as f:
        image_index = json.load(f)

    if not image_index:
        logger.info("No captioned images found in index — skipping image embedding.")
        return True

    captions = [entry["caption"] for entry in image_index]
    embeddings = get_embeddings_from_api(captions)
    if not embeddings:
        logger.error("Failed to get embeddings for image captions.")
        return False

    metadatas = [
        {
            "filename": entry["filename"],
            "page": entry["page"],
            "caption": entry["caption"],
        }
        for entry in image_index
    ]

    img_collection_name = f"{collection_name}_images"
    logger.info(f"Storing {len(image_index)} image caption embeddings in '{img_collection_name}'...")
    try:
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        try:
            client.delete_collection(name=img_collection_name)
        except Exception:
            pass
        collection = client.get_or_create_collection(name=img_collection_name)
        ids = [f"img_{i}" for i in range(len(image_index))]
        collection.add(embeddings=embeddings, documents=captions, metadatas=metadatas, ids=ids)
        logger.info(f"Image captions stored in ChromaDB collection '{img_collection_name}'.")
        return True
    except Exception as e:
        logger.error(f"Error storing image captions in ChromaDB: {e}", exc_info=True)
        return False


def process_and_embed(json_path, collection_name, blocks_json_path=None):
    """
    Master pipeline: load blocks → sentence-chunk with bbox → embed → store in ChromaDB.
    blocks_json_path must point to the _blocks.json saved by extract_text_blocks().
    """
    logger.info(f"Starting embedding pipeline for: {json_path}")

    if not blocks_json_path or not os.path.exists(blocks_json_path):
        logger.error("blocks_json_path is required but missing. Re-upload the PDF.")
        return False

    pages_data = load_text_blocks(blocks_json_path)
    tagged_chunks = chunk_blocks(pages_data)

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
