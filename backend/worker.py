import os
import asyncio
from celery import Celery
import logging
import shutil
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from langdetect import detect

from extraction_utils import extract_text, extract_text_blocks, extract_image_index, extract_tables
from embedding_utils import process_and_embed, embed_image_captions
import db

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "research_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_pdf')
EXTRACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'EXTRACT')

@celery_app.task(bind=True)
def process_pdf_task(self, document_id: str, filename: str, notebook_id: str = None):
    """
    Background job to process the PDF.
    """
    logger.info(f"[{document_id}] Starting background processing for {filename}")
    try:
        # Run async DB call synchronously inside celery
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    source = loop.run_until_complete(db.get_source(document_id))
    if not source:
        logger.error(f"[{document_id}] Source not found in DB!")
        return False
        
    file_path = source.file_path

    text_json_path = os.path.join(EXTRACT_DIR, 'text', f"{document_id}.json")
    blocks_json_path = os.path.join(EXTRACT_DIR, 'text', f"{document_id}_blocks.json")

    try:
        logger.info(f"[{document_id}] Step 1: Extracting Text...")
        extract_text(file_path, text_json_path)
        extract_text_blocks(file_path, blocks_json_path)
        
        # --- Language Auto-Detection ---
        try:
            nb_data = loop.run_until_complete(db.get_notebook(notebook_id)) if notebook_id else None
            if nb_data and nb_data.get("language") == "Auto-detect":
                import json
                with open(text_json_path, 'r', encoding='utf-8') as f:
                    pages = json.load(f)
                    first_chunk = pages.get("1", "")[:2000] # Use first 2000 chars for detection
                    if first_chunk:
                        lang_code = detect(first_chunk)
                        # Map standard ISO codes to our supported UI names
                        lang_map = {
                            'en': 'English', 'es': 'Spanish', 'fr': 'French', 
                            'de': 'German', 'hi': 'Hindi', 'bn': 'Bengali', 
                            'te': 'Telugu', 'zh-cn': 'Chinese', 'ja': 'Japanese'
                        }
                        detected_lang = lang_map.get(lang_code, "English")
                        logger.info(f"[{document_id}] Auto-detected language: {detected_lang} ({lang_code})")
                        loop.run_until_complete(db.update_notebook_language(notebook_id, detected_lang))
        except Exception as e:
            logger.warning(f"[{document_id}] Language detection failed: {e}")
        # -------------------------------

        img_dir_path = os.path.join(EXTRACT_DIR, 'images', f"{document_id}_images")
        logger.info(f"[{document_id}] Step 2: Extracting Images + Building Caption Index...")
        image_index = extract_image_index(file_path, img_dir_path, None)

        loop.run_until_complete(db.save_image_index(document_id, image_index))

        # Table Extraction with timeout
        table_dir_path = os.path.join(EXTRACT_DIR, 'tables', f"{document_id}_tables")
        logger.info(f"[{document_id}] Step 3: Extracting Tables (60s timeout)...")
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(extract_tables, file_path, table_dir_path)
                future.result(timeout=60)
        except FutureTimeoutError:
            logger.warning(f"[{document_id}] Table extraction timed out after 60s.")
        except Exception as e:
            logger.warning(f"[{document_id}] Table extraction failed: {e}")

        # Vectorization
        logger.info(f"[{document_id}] Step 4: Chunking and Embedding Text...")
        success = process_and_embed(text_json_path, document_id, blocks_json_path=blocks_json_path, notebook_id=notebook_id)

        logger.info(f"[{document_id}] Step 5: Embedding Image Captions...")
        try:
            loop.run_until_complete(embed_image_captions(document_id))
        except Exception as e:
            logger.warning(f"[{document_id}] Image caption embedding failed: {e}")

        if not success:
            logger.error(f"[{document_id}] Pipeline failed during embedding phase.")
            loop.run_until_complete(db.update_source_status(document_id, 'failed'))
            return {"status": "FAILURE", "document_id": document_id}

        logger.info(f"[{document_id}] Pipeline completed successfully.")
        loop.run_until_complete(db.update_source_status(document_id, 'ready'))
        return {"status": "SUCCESS", "document_id": document_id}
    except Exception as e:
        logger.error(f"[{document_id}] Pipeline encountered exception: {e}")
        loop.run_until_complete(db.update_source_status(document_id, 'failed'))
        return {"status": "FAILURE", "document_id": document_id}

from llm_utils import map_reduce_summarize, generate_mindmap_json
from audio_utils import generate_audio

@celery_app.task(bind=True)
def generate_audio_summary_task(self, notebook_id: str, user_id: str, target_language: str = "English"):
    logger.info(f"Starting audio summary generation for notebook {notebook_id}")
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    texts = loop.run_until_complete(db.get_notebook_texts(notebook_id, limit=12))
    if not texts:
        return {"status": "FAILURE", "error": "No text found for notebook"}
        
    script = map_reduce_summarize(texts, target_language=target_language)
    print(f"\\n{'='*50}\\nGENERATED AUDIO SCRIPT:\\n{script}\\n{'='*50}\\n")
    logger.info(f"Generated Audio Script: {script}")
    
    # Dual voice mapping (Female, Male) for Alice & Bob format
    VOICE_MAP = {
        "English": ("en-US-AriaNeural", "en-US-GuyNeural"),
        "Spanish": ("es-ES-ElviraNeural", "es-ES-AlvaroNeural"),
        "French": ("fr-FR-DeniseNeural", "fr-FR-HenriNeural"),
        "German": ("de-DE-AmalaNeural", "de-DE-KillianNeural"),
        "Hindi": ("hi-IN-SwaraNeural", "hi-IN-MadhurNeural"),
        "Bengali": ("bn-IN-TanishaaNeural", "bn-IN-BashkarNeural"),
        "Telugu": ("te-IN-ShrutiNeural", "te-IN-MohanNeural"),
        "Chinese": ("zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"),
        "Japanese": ("ja-JP-NanamiNeural", "ja-JP-KeitaNeural")
    }
    voices = VOICE_MAP.get(target_language, VOICE_MAP["English"])

    # Generate audio
    output_dir = os.path.join(DATA_DIR, user_id, notebook_id, "audio")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "summary.mp3")
    
    success = generate_audio(script, output_path, voices=voices)
    if success:
        return {"status": "SUCCESS", "audio_path": f"/api/notebooks/{notebook_id}/audio"}
    else:
        return {"status": "FAILURE", "error": "TTS failed"}

@celery_app.task(bind=True)
def generate_mindmap_task(self, notebook_id: str, user_id: str, focus_topic: str, is_expansion: bool = False, max_levels: int = 3):
    logger.info(f"Starting mindmap generation for notebook {notebook_id} on '{focus_topic}'")
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    texts = loop.run_until_complete(db.get_notebook_texts(notebook_id, limit=30))
    if not texts:
        return {"status": "FAILURE", "error": "No text found for notebook"}
        
    json_result_str = generate_mindmap_json(texts, focus_topic, max_levels)
    
    import json
    try:
        mindmap_data = json.loads(json_result_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse mindmap JSON: {e}")
        return {"status": "FAILURE", "error": "LLM returned invalid JSON"}
    
    # Only overwrite the saved file if this is a brand new base generation
    if not is_expansion:
        try:
            # Save directly to the database instead of the file system
            loop.run_until_complete(db.save_mindmap(notebook_id, mindmap_data))
        except Exception as e:
            logger.error(f"Failed to save mindmap to DB: {e}")
            
    return {"status": "SUCCESS", "mindmap": mindmap_data}
