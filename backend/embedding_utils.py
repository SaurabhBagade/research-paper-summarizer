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


def _image_to_base64(image_path):
    """Auxiliary: Convert image file to base64 string for the vision API."""
    import base64
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to encode image {image_path}: {e}")
        return None


async def embed_image_captions(document_id):
    """
    Loads the image index from MongoDB, enhances each entry with a Vision AI description,
    and stores them in a separate ChromaDB collection ({document_id}_images).
    Saves the updated index back to MongoDB.
    """
    import db  # Import here to avoid circular import

    # Load image index from MongoDB
    image_index = await db.get_image_index(document_id)
    if not image_index:
        logger.info("No images found in index — skipping image embedding.")
        return True

    # The images are stored in EXTRACT/images/{document_id}_images (mounted under /app/EXTRACT in Docker)
    img_dir_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'EXTRACT', 'images', f"{document_id}_images")

    if not os.path.isdir(img_dir_path):
        logger.warning(
            f"Image directory does not exist for document '{document_id}': {img_dir_path}. "
            "Vision descriptions cannot be generated without images."
        )
        return True

    enriched_texts = []
    logger.info(f"Generating vision descriptions for {len(image_index)} images...")
    
    def process_image(entry):
        img_filename = entry["filename"]
        caption = entry.get("caption", "")
        img_path = os.path.join(img_dir_path, img_filename)
        
        description = ""
        if os.path.exists(img_path):
            img_b64 = _image_to_base64(img_path)
            if img_b64:
                try:
                    # Request visual description from model_api
                    v_resp = requests.post(f"{MODEL_API_URL}/vision", json={"image_base64": img_b64}, timeout=120)
                    if v_resp.status_code == 200:
                        try:
                            resp_json = v_resp.json()
                        except ValueError:
                            logger.warning(f"Vision API returned non-JSON for {img_filename}: {v_resp.text}")
                            resp_json = {}

                        # Support both current and potential old response shapes
                        description = resp_json.get("description") or resp_json.get("response") or ""
                        if not description:
                            logger.warning(
                                f"Vision API returned empty description for {img_filename}; full response: {resp_json}"
                            )
                        else:
                            logger.info(f"Vision description generated for {img_filename} = {description[:50]}...")
                    else:
                        logger.warning(f"Vision API failed for {img_filename}: {v_resp.status_code} {v_resp.text}")
                        description = ""
                except Exception as e:
                    logger.warning(f"Vision description failed for {img_filename}: {e}")
                    description = ""

        if not description and caption:
            # Fall back to caption if the model did not output anything
            description = caption
            logger.debug(f"Falling back to caption text for ai_description of {img_filename}")

        # Combine caption and AI description for the search index
        combined_text = f"Caption: {caption}\nVisual Description: {description}"
        # Store for metadata
        entry["ai_description"] = description
        logger.debug(f"Set ai_description for {img_filename}: '{description[:50]}...'")
        return combined_text

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=4) as executor:
        enriched_texts = list(executor.map(process_image, image_index))

    if not enriched_texts:
        return True


    # Save the updated index (with AI descriptions) to MongoDB even if embedding fails
    try:
        await db.save_image_index(document_id, image_index)
        logger.info(f"Saved image index with AI descriptions to MongoDB for document '{document_id}'")
    except Exception as e:
        logger.warning(f"Failed to save image index to MongoDB for {document_id}: {e}")

    embeddings = get_embeddings_from_api(enriched_texts)
    if not embeddings:
        logger.error("Failed to get embeddings for enriched image data.")
        return False

    metadatas = [
        {
            "filename": entry["filename"],
            "page": entry["page"],
            "caption": entry["caption"],
            "ai_description": entry.get("ai_description", "")[:500] # Limit size for metadata
        }
        for entry in image_index
    ]

    img_collection_name = f"{document_id}_images"
    logger.info(f"Storing {len(image_index)} enriched image embeddings in '{img_collection_name}'...")

    try:
        client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
        try:
            client.delete_collection(name=img_collection_name)
        except Exception:
            pass
        collection = client.get_or_create_collection(name=img_collection_name)
        ids = [f"img_{i}" for i in range(len(image_index))]
        collection.add(embeddings=embeddings, documents=enriched_texts, metadatas=metadatas, ids=ids)
        logger.info(f"Enriched image index stored in ChromaDB.")

        # Save the updated index back to MongoDB with ai_descriptions
        await db.save_image_index(document_id, image_index)
        logger.info(f"Updated image index with AI descriptions saved to MongoDB for {document_id}")

        return True
    except Exception as e:
        logger.error(f"Error storing image embeddings in ChromaDB: {e}", exc_info=True)
        return False


def process_and_embed(json_path, collection_name, blocks_json_path=None):
    """
    Master pipeline: load blocks → sentence-chunk with bbox → embed → store in ChromaDB.
    blocks_json_path must point to the _blocks.json saved by extract_text_blocks().
    """
    logger.info(f"Starting embedding pipeline for: {json_path}")

    if not blocks_json_path or not os.path.exists(blocks_json_path):
        logger.warning("blocks_json_path missing; falling back to raw text chunking.")
        pages_data = []
    else:
        pages_data = load_text_blocks(blocks_json_path)

    tagged_chunks = chunk_blocks(pages_data)

    if not tagged_chunks:
        logger.warning("No chunks generated from blocks; falling back to raw text.")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                raw_pages = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load raw text JSON for fallback chunking: {e}")
            return False

        # Create a chunk per page (or per large paragraph) so we can still embed something
        tagged_chunks = []
        for page_num_str, page_text in raw_pages.items():
            page_num = int(page_num_str)
            if not page_text.strip():
                continue
            tagged_chunks.append({
                "text": page_text.strip(),
                "page_num": page_num,
                "bbox": [0, 0, 0, 0],
                "page_width": 0,
                "page_height": 0,
            })

        if not tagged_chunks:
            logger.error("Fallback chunking produced no text.")
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
