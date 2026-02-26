# Research Paper Summarizer & Chatbot

A Dockerized pipeline to ingest research papers (PDFs), extract text/images/tables, chunk the text, generate vector embeddings using local ML models, and store them in a Vector Database (ChromaDB) for retrieval-augmented generation (RAG) tasks.

## 🏗️ Architecture

This project has been refactored from a heavy Apache Airflow distributed pipeline into a lightweight, fast, containerized FastAPI backend. The entire stack runs locally via Docker Compose.

There are three primary containers:
1. **`backend`**: A FastAPI orchestrator. It receives PDF uploads, handles the extraction (PyMuPDF, pdfplumber), chunks the text (Langchain), and coordinates with the other containers.
2. **`model_api`**: A local Machine Learning API running on PyTorch/CUDA. It loads `allenai/specter2_base` for generating embeddings and `google/flan-t5-base` for text generation/summarization tasks.
3. **`chromadb`**: The local Vector Database where all embedded document chunks are persistently stored.

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed.
- (Optional but Recommended) NVIDIA GPU with latest drivers and Docker NVIDIA Container Toolkit installed (for GPU-accelerated inference in `model_api`).

### Setup

1. **Clone the repository.**
2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (where `docker-compose.yaml` is located) with the following variable if needed:
   ```env
   HF_TOKEN=your_huggingface_token
   ```

3. **Start the containers:**
   ```bash
   docker-compose up -d --build
   ```
   *Note: On the very first boot, the `model_api` container will download the Specter2 and T5 models (~3-4 GB total) into the `model_api/cache` directory. Subsequent boots will be instantaneous.*

### Usage

1. **Access the Backend API Documentation:**
   Open your browser and navigate to: [http://localhost:8080/docs](http://localhost:8080/docs)
   
2. **Upload a PDF:**
   - Find the `POST /upload-pdf` endpoint in the Swagger UI.
   - Click "Try it out", select a PDF file, and execute.
   - The backend will:
     - Save the PDF to `data_pdf/`.
     - Extract text, images, and tables into the `EXTRACT/` folder.
     - Chunk the extracted text.
     - Call the `model_api` container to fetch Specter2 embeddings.
     - Store the documents and embeddings into ChromaDB.

## 📁 Directory Structure

```text
.
├── backend/                  # Orchestration FastAPI App
│   ├── main.py               # API Endpoints and logic flow
│   ├── extraction_utils.py   # PDF text, image, and table extraction logic
│   ├── embedding_utils.py    # Langchain chunking and ChromaDB insertion
│   ├── Dockerfile            # Python 3.10 slim environment
│   └── requirements.txt
├── model_api/                # Local ML Inference App
│   ├── app.py                # FastAPI endpoints for /embed and /generate
│   ├── Dockerfile            # PyTorch CUDA environment
│   └── requirements.txt
├── docker-compose.yaml       # Defines networking, volumes, and services
└── EXTRACT/                  # Output directory (auto-generated)
    ├── images/
    ├── tables/
    ├── text/
    └── vectorstore/          # ChromaDB persistent storage
```

## 🛠️ Built With

- **[FastAPI](https://fastapi.tiangolo.com/)**: Fast, modern web framework for building APIs.
- **[LangChain](https://python.langchain.com/)**: For intelligent text splitting and chunking.
- **[Chroma](https://www.trychroma.com/)**: AI-native open-source vector database.
- **[PyMuPDF (fitz)](https://pymupdf.readthedocs.io/) & [pdfplumber](https://github.com/jsvine/pdfplumber)**: PDF data extraction.
- **[Sentence Transformers](https://www.sbert.net/)**: Local embeddings generation (Specter2).
- **[Hugging Face Transformers](https://huggingface.co/docs/transformers/index)**: Local text generation (Flan-T5).
