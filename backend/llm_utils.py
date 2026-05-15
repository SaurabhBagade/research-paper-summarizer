import os
import requests
import logging
from typing import List
import re

logger = logging.getLogger(__name__)

MODEL_API_URL = os.getenv("MODEL_API_URL", "http://model_api:8008")

def query_llm(prompt: str, max_new_tokens: int = 512, temperature: float = 0.3) -> str:
    """Synchronous HTTP call to the local LLM container."""
    try:
        response = requests.post(
            f"{MODEL_API_URL}/generate",
            json={
                "prompt": prompt,
                "max_length": max_new_tokens,
                "temperature": temperature
            },
            timeout=180
        )
        response.raise_for_status()
        return response.json().get("generated_text", "")
    except Exception as e:
        logger.error(f"Failed to query LLM: {e}")
        return ""

def map_reduce_summarize(texts: List[str], target_language: str = "English") -> str:
    """
    Performs a simplified Map-Reduce summarization over a list of text chunks.
    """
    if not texts:
        return "No text available to summarize."
        
    # Combine texts into larger batches to reduce the number of sequential LLM calls
    batch_size = 4
    batched_texts = ["\n".join(texts[i:i+batch_size]) for i in range(0, len(texts), batch_size)]
        
    # Map step: Summarize batched chunks
    chunk_summaries = []
    for text in batched_texts:
        prompt = f"Summarize the following text concisely. You MUST write the summary entirely in {target_language}:\n\n{text}\n\nSummary in {target_language}:"
        summary = query_llm(prompt, max_new_tokens=150)
        if summary:
            chunk_summaries.append(summary)
            
    # Reduce step: Combine summaries into a final script
    combined = "\n".join(chunk_summaries)
    reduce_prompt = (
        f"You are an AI podcast producer. Combine the following summaries into a smooth, "
        "engaging 1-minute podcast script that highlights the main research findings. "
        "The podcast features two speakers: Alice (the host) and Bob (the expert). "
        f"CRITICAL INSTRUCTION: You MUST write the actual spoken dialogue entirely in {target_language}. Do not write the dialogue in English. "
        "However, keep the speaker labels 'Alice:' and 'Bob:' exactly as they are in English.\n"
        "Format the output strictly as a dialogue, alternating between the speakers like this:\n"
        f"Alice: [Dialogue spoken in {target_language}]\n"
        f"Bob: [Dialogue spoken in {target_language}]\n"
        "Do not include sound effects, brackets, or other speaker labels. Just Alice and Bob.\n\n"
        f"Summaries:\n{combined}\n\nAudio Script in {target_language}:"
    )
    final_script = query_llm(reduce_prompt, max_new_tokens=400, temperature=0.5)
    return final_script.strip() if final_script else "Failed to generate audio script."

def generate_mindmap_json(texts: List[str], focus_topic: str, max_levels: int = 3) -> str:
    """
    Prompts the LLM to generate a structured JSON mindmap from the provided texts.
    """
    combined_text = "\n".join(texts)
    # Truncate text naively if too long to prevent context overflow
    if len(combined_text) > 15000:
        combined_text = combined_text[:15000]

    prompt = (
        f"Generate a comprehensive, multi-level mindmap focusing on '{focus_topic}' based on the text below.\n"
        f"CRITICAL STRUCTURAL INSTRUCTION: You must build this mindmap to exactly {max_levels} levels of depth. Do not create nodes deeper than this level.\n"
        "Level 1: Main Topic. Level 2: Sub Topics. Level 3: Supporting Concepts.\n"
        "You MUST output strictly valid JSON with this exact schema:\n"
        "{\n"
        "  \"nodes\": [{\"id\": \"node1\", \"label\": \"Main Topic\"}, {\"id\": \"node2\", \"label\": \"Sub Topic\"}],\n"
        "  \"edges\": [{\"source\": \"node1\", \"target\": \"node2\", \"label\": \"includes\"}]\n"
        "}\n"
        "Do NOT output markdown code blocks. Just the raw JSON.\n\n"
        f"Text:\n{combined_text}\n\nJSON Output:"
    )
    
    response_json_str = query_llm(prompt, max_new_tokens=2048, temperature=0.3)
    
    # Extract JSON object between the first '{' and the last '}'
    match = re.search(r'(\{.*\})', response_json_str, re.DOTALL)
    if match:
        response_json_str = match.group(1)
    else:
        # Fallback basic cleanup
        response_json_str = response_json_str.strip()
        if response_json_str.startswith("```json"):
            response_json_str = response_json_str[7:]
        if response_json_str.endswith("```"):
            response_json_str = response_json_str[:-3]
        
    return response_json_str.strip()
