# Research Paper Summarizer (Research Canvas)

An advanced, local-first, multimodal AI platform designed to help researchers, students, and professionals efficiently analyze, summarize, and interact with complex research papers. 

The project introduces the concept of a **"Research Canvas"**—a unified workspace where users can upload PDFs, extract multi-modal data (text, tables, images), chat with their documents using RAG (Retrieval-Augmented Generation), and generate rich enhancements like Podcast-style Audio Summaries and interactive Mindmaps.

---

## 🌟 Key Features

- **Advanced Document Ingestion:** Extracts text, crops images, and parses tables from complex PDF layouts using `PyMuPDF` and `pdfplumber`.
- **Smart Tagging (NER):** Utilizes `spaCy` to automatically extract key metadata such as Authors, Datasets, Metrics, and Algorithms.
- **Interactive "Research Canvas" UI:** A sleek 3-pane interface:
  1. **Sources (Left):** Manages uploaded PDFs, displays NER tags, and highlights source citations.
  2. **Chat (Middle):** A Socratic, RAG-powered chatbot utilizing local LLMs to answer questions with exact citations.
  3. **Enhancements (Right):** Houses interactive generated assets like Audio and Mindmaps.
- **Podcast-Style Audio Summaries:** Uses `Edge-TTS` to generate natural-sounding audio summaries via async tasks (requires 0MB local VRAM).
- **Interactive Mindmaps:** Dynamically generates structured JSON via the LLM to visualize core concepts using React Flow.
- **Secure & Isolated:** JWT-based authentication ensuring isolated workspaces for different users.
- **Fully Local AI:** Completely local, privacy-preserving AI inference powered by `Ollama` running Gemma4.

---

## 🏗️ System Architecture

The application is fully containerized and consists of several interconnected microservices orchestrated via Docker Compose.

### 1. Frontend (`frontend` container)
- **Stack:** React, Vite, TailwindCSS, React Flow.
- **Role:** Serves the highly interactive 3-pane UI. Communicates with the Backend API, renders markdown/images in chat, and polls the backend for asynchronous task progress.

### 2. Backend Orchestrator (`backend` container)
- **Stack:** FastAPI, Python, LangChain, spaCy.
- **Role:** The central brain of the application. It handles API routing, JWT authentication, PDF chunking/parsing, and orchestrates the Retrieval-Augmented Generation (RAG) pipeline.

### 3. Model API (`model_api` container)
- **Stack:** FastAPI, PyTorch.
- **Role:** A dedicated lightweight API gateway that proxies requests to the heavy local LLM instances. It connects to the host machine's native `Ollama` server (running `gemma4:e2b`).

### 4. Vector Database (`postgres` container)
- **Stack:** PostgreSQL + `pgvector`.
- **Role:** Stores relational data (Users, Canvas Metadata) alongside high-dimensional vector embeddings of document chunks for semantic search.

### 5. Asynchronous Task Queue (`redis` & `celery_worker` containers)
- **Stack:** Redis (Message Broker), Celery (Worker).
- **Role:** Offloads long-running, CPU-intensive tasks from the main FastAPI thread. Currently handles:
  - Background PDF extraction and vectorization.
  - **Audio Generation:** Map-Reduce summarization followed by Edge-TTS audio synthesis.
  - **Mindmap Generation:** Prompting the LLM for structured JSON representations of the paper's concepts.

---

## ⚙️ How It Works (The Data Flow)

### Phase 1: Ingestion & Extraction
1. A user uploads a research paper (PDF) to their personalized Research Canvas.
2. The FastAPI backend saves the file and queues an ingestion task via Celery.
3. The Celery worker uses `PyMuPDF`/`pdfplumber` to extract text blocks, tables, and crops images, saving them to the local disk volume.
4. `spaCy` runs over the text to extract Named Entities (Authors, Metrics, etc.).
5. Text is chunked, embedded, and stored in the `pgvector` database.

### Phase 2: Conversational RAG
1. The user asks a question in the Middle Pane.
2. The Backend embeds the query and retrieves the most relevant text chunks and associated image paths from PostgreSQL.
3. The context is bundled into a Socratic prompt and sent to the `model_api` (which forwards to the local Gemma4 model).
4. The LLM streams a response back to the frontend, including source citations (e.g., `[1]`). Clicking these citations highlights the original text in the Left Pane.

### Phase 3: Enhancements (Async Generation)
1. The user clicks "Generate Audio" or "Generate Mindmap" in the Right Pane.
2. A Celery task is dispatched, and the UI receives a `task_id` to poll for progress.
3. **For Audio:** The text is summarized via Map-Reduce, passed to Edge-TTS, and an MP3 file is saved to storage.
4. **For Mindmap:** Gemma4 generates a structured node/edge JSON graph representing the paper.
5. The frontend fetches the finalized assets and renders the custom Audio Player or React Flow interactive map.

---

## 🚀 Running the Project Locally

### Prerequisites
- Docker and Docker Compose
- Ollama installed natively on your host machine.
- The `gemma4:e2b` model pulled locally via Ollama (`ollama run gemma4:e2b`).

### Start the Stack

1. Clone the repository and navigate to the project root.
2. Create a `.env` file and configure your environment variables (e.g., `HF_TOKEN`, `JWT_SECRET`).
3. Build and launch the containers:

```bash
docker-compose up --build -d
```

### Accessing the Application
- **Frontend UI:** `http://localhost:3001`
- **Backend API Docs:** `http://localhost:8080/docs`
- **Model API Docs:** `http://localhost:8008/docs`

---

## 🔒 Data Isolation & Security

This application is built with a robust JWT authentication layer. Every File, Extracted Asset, and Chat Session is strictly bound to a `user_id`. Users can only access the "Research Canvases" they have explicitly created, ensuring data privacy across multiple users on the same instance.

---

## 🔮 Future Roadmap

- Expanding multi-modal support to allow the LLM to directly interpret the extracted images (Vision capabilities).
- Adding automated deployment scripts for remote GPU-enabled VPS setups.
- Implementing real-time WebSockets / Server-Sent Events (SSE) to replace frontend HTTP polling for Celery task completion.
