# Research Paper Summarizer (Research Canvas) - Project Overview

An advanced, local-first, multimodal AI platform designed to help researchers, students, and professionals efficiently analyze, summarize, and interact with complex research papers. The project introduces the concept of a **"Research Canvas"**—a unified, isolated workspace where users can upload PDFs, extract multi-modal data (text, tables, images), chat with their documents using RAG (Retrieval-Augmented Generation), and generate rich enhancements like Podcast-style Audio Summaries and interactive Mindmaps.

---

## 🌟 Key Features

- **Advanced Document Ingestion:** Extracts text, crops images, and parses tables from complex PDF layouts using `PyMuPDF` and `pdfplumber`.
- **Smart Tagging (NER):** Utilizes `spaCy` to automatically extract key metadata such as Authors, Datasets, Metrics, and Algorithms from the paper's content.
- **Interactive "Research Canvas" UI:** A sleek 3-pane interface for a unified user experience:
  1. **Sources (Left):** Manages uploaded PDFs, displays automatically extracted NER tags, and highlights source citations from the chat.
  2. **Chat (Middle):** A Socratic, RAG-powered chatbot utilizing local LLMs to answer questions with exact, clickable citations.
  3. **Enhancements (Right):** Houses interactive generated assets like a custom audio player for summaries and a dynamic mindmap for visualizing concepts.
- **Podcast-Style Audio Summaries:** Uses `Edge-TTS` to generate natural-sounding audio summaries via asynchronous Celery tasks, requiring zero local VRAM.
- **Interactive Mindmaps:** Dynamically generates a structured JSON graph via the LLM to visualize the paper's core concepts using React Flow.
- **Secure & Isolated Workspaces:** Features robust JWT-based authentication, ensuring that each user's Research Canvases and data are completely private.
- **Fully Local & Private AI:** Powered by `Ollama` running local models like `gemma4:e2b`, ensuring all processing happens on the user's machine for maximum privacy.

---

## 🏗️ System Architecture

The application is fully containerized using Docker Compose and follows a microservices architecture to separate concerns and ensure scalability.

### 1. Frontend (`frontend` container)
- **Stack:** React, Vite, TailwindCSS, React Flow.
- **Role:** Serves the highly interactive 3-pane "Research Canvas" UI. It communicates with the Backend API for data and authentication, renders markdown and images in the chat, and polls for the progress of asynchronous tasks like audio and mindmap generation.

### 2. Backend Orchestrator (`backend` container)
- **Stack:** FastAPI, Python, LangChain, spaCy.
- **Role:** The central brain of the application. It handles all API routing, JWT authentication, user management, and orchestrates the entire Retrieval-Augmented Generation (RAG) pipeline. It delegates long-running tasks to the Celery worker.

### 3. Model API (`model_api` container)
- **Stack:** FastAPI, PyTorch.
- **Role:** A dedicated, lightweight API gateway that proxies requests to the local LLM instances managed by `Ollama` on the host machine. This decouples the main backend from the heavy model inference. It serves endpoints for text generation and creating embeddings.

### 4. Vector Database (`postgres` container)
- **Stack:** PostgreSQL with the `pgvector` extension.
- **Role:** Acts as the primary persistence layer. It stores relational data (Users, Research Canvases, Files) alongside high-dimensional vector embeddings of document chunks for efficient semantic search.

### 5. Asynchronous Task Queue (`redis` & `celery_worker` containers)
- **Stack:** Redis (Message Broker), Celery (Distributed Task Queue).
- **Role:** Offloads long-running, CPU/GPU-intensive tasks from the main API thread to prevent blocking and timeouts. The `celery_worker` handles:
  - Background PDF ingestion, extraction, and vectorization.
  - **Audio Generation:** A map-reduce summarization process followed by `Edge-TTS` audio synthesis.
  - **Mindmap Generation:** Prompting the LLM to generate a structured JSON representation of the paper's concepts.

---

## ⚙️ How It Works: The Data Flow

### Phase 1: Ingestion & Extraction
1. A user uploads a research paper (PDF) to their personal Research Canvas.
2. The FastAPI backend saves the file and queues an ingestion task in Celery, returning a `task_id` to the frontend.
3. The Celery worker picks up the task and uses `PyMuPDF`/`pdfplumber` to extract text blocks, tables, and images. Extracted assets are saved to a shared disk volume.
4. `spaCy` is used to perform Named Entity Recognition (NER) on the extracted text to identify and tag key information (Authors, Metrics, etc.).
5. The text is split into chunks, which are then sent to the `model_api` to be converted into vector embeddings.
6. The chunks, their embeddings, and associated metadata (page number, file source, image paths) are stored in the `pgvector` database, linked to the user and canvas.

### Phase 2: Conversational RAG
1. The user asks a question in the chat pane.
2. The backend embeds the user's query and performs a hybrid search (semantic vector search + keyword search) against the PostgreSQL database to find the most relevant text chunks and associated images.
3. This retrieved context is bundled into a Socratic-style prompt and sent to the `model_api`, which forwards it to the local `gemma4` model via Ollama.
4. The LLM streams a response back to the frontend. The response includes source citations (e.g., `[1]`). When a user clicks a citation, the UI highlights the original source text in the left pane.

### Phase 3: Asynchronous Enhancements
1. The user clicks "Generate Audio" or "Generate Mindmap" in the right-hand enhancements pane.
2. An API request is sent to the backend, which dispatches a new Celery task and returns a `task_id`. The UI begins polling a status endpoint for that task.
3. **For Audio:** The worker task performs a map-reduce summarization of the paper's text, passes the summary to `Edge-TTS` for audio synthesis, and saves the resulting MP3 file to storage.
4. **For Mindmap:** The worker task prompts the LLM to generate a structured node-and-edge JSON graph representing the paper's key concepts.
5. Once the task is complete, the polling frontend fetches the URL of the generated asset (MP3 or JSON) and renders the custom Audio Player or the interactive React Flow mindmap.

---

## 🔒 Security & Data Isolation

The application is built with a robust JWT (JSON Web Token) authentication layer. All database models, including `ResearchCanvas`, `File`, `DocumentChunk`, and `ChatSession`, are strictly tied to a `user_id`. This ensures that users can only access, view, and interact with the canvases and documents they have created, guaranteeing complete data privacy and isolation between different users on the same instance.

---

## 🚀 Running the Project Locally

### Prerequisites
- Docker and Docker Compose
- Ollama installed natively on your host machine.
- The `gemma4:e2b` model pulled locally via Ollama (`ollama run gemma4:e2b`).

### Start the Stack

1. Clone the repository and navigate to the project root.
2. Create a `.env` file and configure your environment variables (e.g., `JWT_SECRET`).
3. Build and launch the containerized application:

```bash
docker-compose up --build -d
```

### Accessing the Application
- **Frontend UI:** `http://localhost:3001`
- **Backend API Docs:** `http://localhost:8080/docs`
- **Model API Docs:** `http://localhost:8008/docs`