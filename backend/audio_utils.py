import os
import subprocess
import logging

logger = logging.getLogger(__name__)

def generate_audio(text: str, output_path: str, voice: str = "en-US-ChristopherNeural") -> bool:
    """
    Generates audio using edge-tts CLI.
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        logger.info(f"Generating TTS Audio to {output_path}...")
        
        # We must invoke edge-tts. Make sure text is sanitized of quotes if passed via CLI, 
        # or better yet, pass it via a temporary file or standard input.
        # But edge-tts accepts --text as string safely through subprocess.run lists.
        result = subprocess.run(
            ["edge-tts", "--voice", voice, "--text", text, "--write-media", output_path],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            logger.error(f"edge-tts failed: {result.stderr}")
            return False
            
        logger.info("Audio generation complete.")
        return True
    except Exception as e:
        logger.error(f"Exception during audio generation: {e}")
        return False
