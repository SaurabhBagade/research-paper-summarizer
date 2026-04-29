import os
import requests
import logging
from typing import List

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

def map_reduce_summarize(texts: List[str]) -> str:
    """
    Performs a simplified Map-Reduce summarization over a list of text chunks.
    """
    if not texts:
        return "No text available to summarize."
        
    # Map step: Summarize individual chunks
    chunk_summaries = []
    for text in texts:
        prompt = f"Summarize the following text concisely:\n\n{text}\n\nSummary:"
        summary = query_llm(prompt, max_new_tokens=150)
        if summary:
            chunk_summaries.append(summary)
            
    # Reduce step: Combine summaries into a final script
    combined = "\n".join(chunk_summaries)
    reduce_prompt = (
        "You are an AI podcast host. Combine the following summaries into a smooth, "
        "engaging 1-minute audio script that highlights the main research findings. "
        "Do not include sound effects or speaker labels, just the spoken text.\n\n"
        f"Summaries:\n{combined}\n\nAudio Script:"
    )
    final_script = query_llm(reduce_prompt, max_new_tokens=400, temperature=0.5)
    return final_script.strip() if final_script else "Failed to generate audio script."

def generate_mindmap_json(texts: List[str], focus_topic: str) -> str:
    """
    Prompts the LLM to generate a structured JSON mindmap from the provided texts.
    """
    combined_text = "\n".join(texts)
    # Truncate text naively if too long to prevent context overflow
    if len(combined_text) > 15000:
        combined_text = combined_text[:15000]

    prompt = (
        f"Generate a mindmap focusing on '{focus_topic}' based on the text below.\n"
        "You MUST output strictly valid JSON with this exact schema:\n"
        "{\n"
        "  \"nodes\": [{\"id\": \"node1\", \"label\": \"Concept A\"}],\n"
        "  \"edges\": [{\"source\": \"node1\", \"target\": \"node2\", \"label\": \"relates to\"}]\n"
        "}\n"
        "Do NOT output markdown code blocks. Just the raw JSON.\n\n"
        f"Text:\n{combined_text}\n\nJSON Output:"
    )
    
    response_json_str = query_llm(prompt, max_new_tokens=800, temperature=0.2)
    # Clean up potential markdown formatting
    response_json_str = response_json_str.strip()
    if response_json_str.startswith("```json"):
        response_json_str = response_json_str[7:]
    if response_json_str.endswith("```"):
        response_json_str = response_json_str[:-3]
        
    return response_json_str.strip()
