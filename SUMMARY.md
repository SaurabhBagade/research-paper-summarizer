## Research Paper Summarizer System Overview

The Research Paper Summarizer is a sophisticated, multi-component system designed to ingest academic research papers (PDFs), extract structured knowledge, and provide advanced Question-Answering (Q&A) and summarization capabilities. The architecture is modular, separating concerns into API handling, background processing, data persistence, and LLM interaction.

### 📚 Core Functionality

1.  **PDF Ingestion & Extraction:** Accepts PDF files and initiates a background pipeline to extract structured data.
2.  **Knowledge Indexing:** Extracts text, images, and tables, and converts the text into searchable vector embeddings.
3.  **Advanced Q&A (RAG):** Allows users to ask natural language questions, retrieving context from the indexed document chunks and generating an answer using a Large Language Model (LLM).
4.  **Notebook Management:** Enables users to group related documents and maintain conversational context across multiple sources.

### ⚙️ System Architecture & Components

The system is composed of four main services:

#### 1. FastAPI API Gateway (`research-paper-summarizer/backend/main.py`)
*   **Role:** The public-facing entry point. Handles HTTP requests, manages user sessions, and orchestrates the workflow.
*   **Key Endpoints:**
    *   `/api/upload-pdf`: Receives PDF files and triggers the background processing task.
    *   `/api/notebooks`: Manages the creation and retrieval of knowledge notebooks.
    *   `/api/ask`: The primary Q&A endpoint. It performs the Retrieval-Augmented Generation (RAG) process.
    *   `/api/sessions`: Manages conversational history for context retention.
*   **Workflow:** It validates inputs, saves metadata to the database, and delegates heavy lifting to the Celery worker.

#### 2. Celery Worker (`research-paper-summarizer/backend/worker.py`)
*   **Role:** Executes long-running, resource-intensive tasks asynchronously, preventing API timeouts.
*   **Pipeline Steps:**
    1.  **Text Extraction:** Uses `extraction_utils` to get raw text and structured text blocks.
    2.  **Image Indexing:** Extracts figures and builds a metadata index for image retrieval.
    3.  **Table Extraction:** Uses a thread pool executor for robust table detection and extraction.
    4.  **Chunking & Embedding:** Splits the raw text into manageable chunks and generates high-dimensional embeddings using the `model_api`.
    5.  **Caption Embedding:** Embeds image captions to allow visual context searching.

#### 3. Database Layer (`research-paper-summarizer/backend/db.py`)
*   **Role:** Persistence layer using PostgreSQL (with `asyncpg` and `pgvector` extension).
*   **Key Data Models:**
    *   **`Source`:** Maps a document ID to its original filename and metadata.
    *   **`DocumentChunk`:** Stores the actual text chunk, its page number, and associated metadata.
    *   **`Embedding`:** Stores the vector embedding (Specter2) linked to a specific `DocumentChunk`.
    *   **`Notebook` / `Session`:** Manages user-defined groups of sources and conversational history.
*   **Search Capabilities:**
    *   **Vector Search:** Uses L2 distance on embeddings for semantic similarity search.
    *   **Hybrid Search:** Combines vector similarity search with full-text keyword search (GIN/`plainto_tsquery`) for robust retrieval.

#### 4. Model API Service (`research-paper-summarizer/model_api/app.py`)
*   **Role:** Acts as a dedicated interface to external AI models (Ollama).
*   **Key Models:**
    *   **Embeddings:** Uses `allenai/specter2_base` for generating high-quality, domain-specific embeddings.
    *   **Text Generation:** Uses Mistral via Ollama for complex reasoning and summarization based on retrieved context.
    *   **Vision:** Uses Moondream via Ollama to generate detailed descriptions of figures and charts from images.

### 🚀 Data Flow Summary (Q&A Example)

1.  **User Query:** User sends a query to `/api/ask`.
2.  **Embedding:** `main.py` sends the query to `model_api` to get a query vector.
3.  **Retrieval:** `db.py` executes a hybrid search (vector + keyword) against the relevant `Notebook` or `Document`.
4.  **Context Assembly:** The top `N` relevant text chunks and their metadata are returned.
5.  **Generation:** `main.py` sends the combined prompt (Context + History + Query) to `model_api`'s `/generate` endpoint.
6.  **Response:** The LLM generates the final answer, which is then saved back to the database for history and displayed to the user.

---
*This summary provides a high-level technical overview of the system's components, data flow, and core functionalities.*"