import os
import subprocess
import logging
import tempfile

logger = logging.getLogger(__name__)

def generate_audio(text: str, output_path: str, voices: tuple = ("en-US-AriaNeural", "en-US-GuyNeural")) -> bool:
    """
    Generates a podcast-style multi-speaker audio using edge-tts CLI.
    Parses 'Alice: ...' and 'Bob: ...' to assign different voices.
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        logger.info(f"Generating TTS Podcast Audio to {output_path}...")
        
        voice_map = {
            "Alice": voices[0] if voices else "en-US-AriaNeural",
            "Bob": voices[1] if len(voices) > 1 else "en-US-GuyNeural"
        }
        
        # Split the script into lines
        lines = text.split('\n')
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_files = []
            
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Default voice and text
                voice = voice_map["Bob"]
                speak_text = line
                
                # Detect speaker prefix
                if ":" in line:
                    speaker_prefix, spoken = line.split(":", 1)
                    speaker_clean = speaker_prefix.strip().replace('*', '').replace('**', '')
                    
                    if "Alice" in speaker_clean:
                        voice = voice_map["Alice"]
                        speak_text = spoken.strip()
                    elif "Bob" in speaker_clean:
                        voice = voice_map["Bob"]
                        speak_text = spoken.strip()
                
                # Skip empty lines after parsing
                if not speak_text:
                    continue
                    
                temp_file = os.path.join(temp_dir, f"part_{i}.mp3")
                result = subprocess.run(
                    ["edge-tts", "--voice", voice, "--text", speak_text, "--write-media", temp_file],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0 and os.path.exists(temp_file):
                    temp_files.append(temp_file)
                else:
                    logger.error(f"edge-tts failed for line {i}: {result.stderr}")
            
            if not temp_files:
                logger.error("Failed to generate any audio parts.")
                return False
            
            # Concatenate all MP3 parts (Binary append works reliably for CBR mp3s)
            with open(output_path, 'wb') as outfile:
                for temp_file in temp_files:
                    with open(temp_file, 'rb') as infile:
                        outfile.write(infile.read())
        
        logger.info("Podcast audio generation complete.")
        return True
        
    except Exception as e:
        logger.error(f"Exception during podcast audio generation: {e}")
        return False
