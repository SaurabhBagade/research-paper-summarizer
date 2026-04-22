# System Guardrails & Development Rules

These rules dictate the architectural boundaries and development guidelines for the Research Paper Summarizer & Chatbot project. **Always refer to these guardrails before suggesting or implementing new code.**

## 1. Hardware & Model Constraints (Strict 6GB VRAM Limit)
- **Local Priority:** All models run locally unless API solutions require 0 overhead (e.g., Google TTS).
- **Text & Vision Integration:** Use a unified multimodal LLM (`llava:7b` via Ollama) to handle both text reasoning contexts (summaries, mind maps) and vision capabilities (processing screenshots of figures/tables). 
- **Embeddings:** Exclusively use `allenai/specter2_base` for dense, scientific vector representations.
- **Audio/TTS:** Exclusively use `gTTS` (Google Text-to-Speech) for audio generation to prevent blowing out VRAM allocations.

## 2. Architecture & Data Flow
- **PostgreSQL Focus:** We are transitioning to a pure PostgreSQL + `pgvector` environment. Do not write new code or schema implementations relying on MongoDB or ChromaDB.
- **Async-First Execution:** Any function taking longer than a few seconds (e.g., PDF extraction, embedding chunks, model inference) **MUST** be implemented as a background Celery task. The FastAPI event loop must remain unblocked. Do not build synchronous waiting endpoints for heavy data jobs.
- **Message Broker:** Use Redis strictly as the task broker for Celery and for short-lived task-status caching.

## 3. UI/Frontend Principles
- **No Blocking UI:** The frontend must never show a static loading screen for a background job. Always implement polling or WebSockets to display background task progress (e.g., Progress bars for PDF parsing).
- **Modern & Dynamic:** Follow dynamic UI guidelines. Use visual feedback (like highlight bounding boxes on PDFs) and citation grouping in the chat.
- **Component Reusability:** Build stateless React components when possible. Keep API interaction logic contained in designated hooks or API utility files.

## 4. Scope Discipline (MVP Adherence)
- Keep feature creep out. We are building the strict MVP defined in the `IMPLEMENTATION_ROADMAP.md` (Audio Overview, Mind Map, Notebook setup, Chat with citations).
- Do not introduce web scraping, Selenium, or dynamic content extraction algorithms. We rely 100% on the internal knowledge embedded from the uploaded PDFs.

## 5. Security & Stability
- **Sanitize IDs:** Ensure all document IDs and folder strings are properly sanitized (using `sanitize_document_id`) to prevent local directory traversal or invalid naming.
- **Fallback Mechanisms:** If table extraction times out after 60 seconds (as currently implemented), fail gracefully and continue document parsing rather than crashing the worker pipeline.
