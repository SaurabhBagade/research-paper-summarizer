import os
import shutil
import logging
from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Base directories based on docker-compose volume mounts
PDF_DIR = os.getenv("DATA_DIR", "/app/data_pdf")
IMAGE_DIR = os.getenv("EXTRACT_DIR", "/app/EXTRACT")

# Ensure directories exist
os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

class LocalStorageManager:
    @staticmethod
    async def save_pdf(file: UploadFile, safe_filename: str, user_id: str, notebook_id: str) -> str:
        """
        Saves a PDF file to the local PDF_DIR/user_id/notebook_id/pdf/.
        Returns the absolute path to the saved file.
        """
        target_dir = os.path.join(PDF_DIR, user_id, notebook_id or "unassigned", "pdf")
        os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, safe_filename)
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logger.info(f"Saved PDF to {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to save PDF {safe_filename}: {e}", exc_info=True)
            raise e

    @staticmethod
    def save_image(image_bytes: bytes, safe_filename: str) -> str:
        """
        Saves an extracted image to the IMAGE_DIR.
        Returns the absolute path to the saved image.
        """
        file_path = os.path.join(IMAGE_DIR, safe_filename)
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(image_bytes)
            logger.info(f"Saved Image to {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to save Image {safe_filename}: {e}", exc_info=True)
            raise e

    @staticmethod
    def delete_file(file_path: str) -> bool:
        """
        Deletes a file from the local disk.
        """
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file {file_path}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
                return False
        return False
