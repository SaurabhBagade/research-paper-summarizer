# Backend & Model Architecture Changes for NotebookLM UI (PDF-ONLY VERSION)

## 🔴 IMPORTANT: PDF-ONLY SCOPE

This document has been **simplified for PDF-only implementation**.
- ❌ NO web scraping
- ❌ NO URL/article sources
- ❌ NO multi-model embeddings (Specter2 only)
- ✅ PDF uploads only
- ✅ Single embedding model
- ✅ Simpler database schema
- ✅ Faster implementation (~25-35% reduction)

---

## CURRENT STATE ANALYSIS

### Current Backend Capabilities
```
PDF Upload → Extraction → Chunking → Embeddings (Specter2)
→ ChromaDB Storage → RAG Chat → Local Ollama (Mistral 7B)
```

### Current Limitations for New UI
- ❌ Single PDF per session (no notebook org)
- ❌ No notebook/project organization
- ❌ Limited source tracking in responses
- ❌ No action generation (audio, slides, etc.)
- ❌ No export functionality

---

## BACKEND API CHANGES

### 1. NEW DATA MODELS & SCHEMAS

#### Notebook Model (New)
```python
class Notebook(BaseModel):
    id: str  # UUID
    title: str
    description: str
    created_at: datetime
    updated_at: datetime
    tags: List[str]
    color: str  # Gradient color for UI
    sources: List[str]  # List of source IDs
    metadata: Dict[str, Any]
    owner_id: str  # For multi-user support
```

#### Source Model (NEW - PDF ONLY)
```python
class Source(BaseModel):
    id: str
    notebook_id: str
    title: str
    source_type: str = "pdf"  # Always "pdf"
    file_path: str  # Local path to PDF file
    file_size: int  # File size in bytes
    file_hash: str  # SHA256 for deduplication
    metadata: Dict  # PDF metadata (author, creation_date, etc.)
    page_count: int
    date_added: datetime
    language: str = "en"
    chunks: List[DocumentChunk]
    embeddings_count: int
```

#### DocumentChunk Model (Refactor)
```python
class DocumentChunk(BaseModel):
    id: str
    source_id: str  # NOW includes source reference
    notebook_id: str
    text: str
    embedding: List[float]  # Specter2 embedding
    metadata: Dict
    page_number: Optional[int]
    section: Optional[str]
    images: Optional[List[str]]  # Image references
    tables: Optional[List[Dict]]  # Table data
```

#### Message Model (Enhanced)
```python
class Message(BaseModel):
    id: str
    session_id: str
    type: Enum["user", "assistant"]
    content: str
    sources_cited: List[{
        source_id: str
        source_title: str
        chunk_ids: List[str]
        relevance_score: float
    }]
    timestamp: datetime
    language: str
```

#### Session/Chat Model (Enhanced)
```python
class Session(BaseModel):
    id: str
    notebook_id: str
    title: str
    messages: List[Message]
    created_at: datetime
    updated_at: datetime
    sources_used: List[str]  # source_ids referenced
```

---

### 2. NEW API ENDPOINTS

#### Notebook Management
```
POST   /api/notebooks                    # Create notebook
GET    /api/notebooks                    # List all notebooks
GET    /api/notebooks/{notebook_id}      # Get notebook details
PUT    /api/notebooks/{notebook_id}      # Update notebook
DELETE /api/notebooks/{notebook_id}      # Delete notebook
POST   /api/notebooks/{notebook_id}/duplicate  # Duplicate notebook
```

#### Source Management - PDF ONLY
```
POST   /api/sources/upload               # Upload PDF file
GET    /api/sources/{notebook_id}        # List PDFs in notebook
GET    /api/sources/{source_id}          # Get PDF details
PUT    /api/sources/{source_id}          # Update PDF metadata
DELETE /api/sources/{source_id}          # Delete PDF

REMOVED: /api/sources/web, /api/sources/scrape (no web sources)
```

**Request Examples:**

Upload PDF:
```json
POST /api/sources/upload
{
  "notebook_id": "nb-123",
  "file": <binary_pdf>,
  "title": "Paper Title (optional)"
}

Response:
{
  "id": "src-456",
  "title": "Paper Title",
  "page_count": 45,
  "file_size": 5242880,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Chat/Query Endpoints (Enhanced)
```
POST   /api/chat                         # Send message (same)
GET    /api/sessions/{session_id}        # Get session (enhanced)
POST   /api/sessions/{session_id}/export # Export conversation
```

**Enhanced Response:**
```json
{
  "message_id": "msg-456",
  "content": "The paper discusses...",
  "sources_cited": [
    {
      "source_id": "src-1",
      "title": "Deep Research Report",
      "relevance": 0.95,
      "chunks": [
        {
          "chunk_id": "chunk-1",
          "text": "Highlighted snippet...",
          "page": 5
        }
      ]
    }
  ],
  "generated_in_ms": 1234
}
```

#### Action Generation Endpoints (NEW)
```
POST   /api/actions/audio                # Generate audio overview
POST   /api/actions/slides               # Generate slide deck
POST   /api/actions/mindmap              # Generate mind map JSON
POST   /api/actions/quiz                 # Generate quiz questions
POST   /api/actions/report               # Generate detailed report
POST   /api/actions/infographic          # Generate infographic
POST   /api/actions/data-table           # Extract structured data

GET    /api/actions/{action_id}/status   # Check generation status
GET    /api/actions/{action_id}/download # Download generated file
```

**Example Requests:**

Audio Generation:
```json
POST /api/actions/audio
{
  "notebook_id": "nb-123",
  "sources": ["src-1", "src-2"],
  "length": "medium",  # short, medium, long
  "language": "en",
  "voice": "ai-generated"  # or specific voice
}
```

Quiz Generation:
```json
POST /api/actions/quiz
{
  "notebook_id": "nb-123",
  "num_questions": 10,
  "difficulty": "medium"  # easy, medium, hard
}
```

#### Search & Filter Endpoints (SIMPLIFIED)
```
GET    /api/search                       # Full-text search across PDFs in notebook
```

---

### 3. DATABASE SCHEMA CHANGES

#### PostgreSQL Schema (New Tables)
```sql
-- Notebooks table
CREATE TABLE notebooks (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Sources table (PDF ONLY - SIMPLIFIED)
CREATE TABLE sources (
    id UUID PRIMARY KEY,
    notebook_id UUID REFERENCES notebooks(id),
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT,
    file_hash VARCHAR(64),  -- SHA256 for deduplication
    page_count INT,
    metadata JSONB,  -- PDF metadata (author, creation_date, etc.)
    language VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    INDEX idx_notebook (notebook_id),
    UNIQUE(file_hash)  -- Prevent duplicate uploads
);

-- Document chunks table (modified)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY,
    source_id UUID REFERENCES sources(id),
    notebook_id UUID REFERENCES notebooks(id),
    text LONGTEXT NOT NULL,
    section VARCHAR(255),
    page_number INT,
    chunk_index INT,
    metadata JSONB,
    created_at TIMESTAMP,
    INDEX idx_source (source_id),
    INDEX idx_notebook (notebook_id)
);

-- Embeddings table (modified to reference source)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY,
    chunk_id UUID REFERENCES document_chunks(id),
    source_id UUID REFERENCES sources(id),
    embedding VECTOR(768),  -- For Specter2
    model_version VARCHAR(50),
    created_at TIMESTAMP,
    UNIQUE(chunk_id),
    INDEX idx_source (source_id)
);

-- Messages table (modified)
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id UUID,
    type VARCHAR(50),  -- user, assistant
    content LONGTEXT,
    sources_cited JSONB,  -- Array of source citations
    created_at TIMESTAMP,
    INDEX idx_session (session_id)
);

-- Actions table (NEW)
CREATE TABLE actions (
    id UUID PRIMARY KEY,
    notebook_id UUID REFERENCES notebooks(id),
    action_type VARCHAR(50),  -- audio, slides, mindmap, quiz, report, etc.
    status VARCHAR(50),  -- pending, processing, completed, failed
    input_params JSONB,
    output_path TEXT,
    file_type VARCHAR(20),  -- mp3, pdf, json, etc.
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    INDEX idx_notebook (notebook_id),
    INDEX idx_status (status)
);
```

---

## MODEL-WISE CHANGES

### 1. EMBEDDING MODEL CHANGES (SIMPLIFIED - SINGLE MODEL ONLY)

**Current Setup:**
- Specter2 for academic papers (768-dim) ✅ KEEP

**New Setup (SIMPLIFIED):**
```
Single model for all PDFs:
   - Model: allenai/specter2_base (768-dim)
   - Use case: ALL research papers
   - Benefit: Optimal quality for academic content, no model selection logic needed
```

**Removed (No longer needed):**
- ❌ Multi-model embedding manager
- ❌ sentence-transformers for other models
- ❌ Model selection logic

**Implementation:**
```python
# Simple, direct approach - no model switching
class EmbeddingManager:
    def __init__(self):
        self.model = SentenceTransformer('allenai/specter2_base')

    def get_embeddings(self, text: str) -> List[float]:
        return self.model.encode(text).tolist()

    @staticmethod
    def get_dimension() -> int:
        return 768  # Always 768
```

---

### 2. TEXT GENERATION MODEL CHANGES

**Current Setup:**
- Ollama running Mistral 7B locally

**Changes for New Features:**

#### For Chat (Keep Current but Enhanced)
- Model: Mistral 7B or better
- Task: Better RAG-aware responses with explicit source tracking
- Prompt template: Include source context more explicitly

```python
# Enhanced prompt template with source tracking
SYSTEM_PROMPT = """
You are a research assistant helping analyze papers.
When responding:
1. Always cite sources explicitly as [Source: Title]
2. Number your citations
3. Be specific about what the source says
4. Distinguish between sources clearly
"""

RAG_TEMPLATE = """
Context from sources:
{context_with_source_labels}

Question: {question}

Respond citing sources clearly.
"""
```

#### For Audio Generation (NEW - Requires New Model)
```
Options:
1. Text-to-Speech:
   - gTTS (free, basic)
   - Eleven Labs API (paid, high quality)
   - Google Cloud TTS API
   - Azure TTS

2. Podcast Generation:
   - Use chat model to create podcast script
   - Then use TTS for narration
   - Add intro/outro generation

Implementation approach:
- Create summary script with Mistral
- Use TTS model to generate audio
- Package as podcast (MP3/WAV)
```

#### For Structured Output (Reports, Quizzes, etc.) (NEW)
```python
# Use Mistral with constrained output

class StructuredGenerator:
    def generate_quiz(self, content: str, num_questions: int):
        """Generate quiz with JSON schema validation"""
        prompt = f"""
        Create {num_questions} multiple choice questions about:
        {content}

        Return as JSON:
        {{
            "questions": [
                {{
                    "id": 1,
                    "question": "...",
                    "options": ["A", "B", "C", "D"],
                    "correct": "A",
                    "explanation": "..."
                }}
            ]
        }}
        """
        # Use JSON schema validation to ensure format

    def generate_report(self, sources: List[str], notebook_id: str):
        """Generate structured report"""
        # Template with sections

    def extract_data_table(self, content: str):
        """Extract structured data from content"""
        # Use regex + LLM for extraction
```

#### For Visual Generation (Slides, Mind Maps, Infographics) (NEW)
```
Three approaches:

1. JSON-to-Visual (Recommended):
   - Generate JSON structure with Mistral
   - Use libraries to convert to visual:
     - Slides: python-pptx (PowerPoint)
     - Mind Maps: graphviz or plotly
     - Infographics: pillow + matplotlib

2. Template-Based:
   - Predefined templates
   - Fill with content
   - Generate visual

3. API-Based:
   - Use Canva API or similar
   - Generate via their service

Best approach for your setup:
- Mistral generates JSON structure
- Python generates visual from JSON
- Export as various formats

Example:
```python
class VisualGenerator:
    def generate_slides(self, notebook_content: str) -> str:
        # 1. Use Mistral to structure content for slides
        structure = mistral.generate_json(
            f"Create slide deck structure from: {notebook_content}"
        )

        # 2. Create PPTX from structure
        prs = Presentation()
        for slide_data in structure["slides"]:
            self._add_slide(prs, slide_data)

        # 3. Save and return path
        prs.save(f"slide_deck.pptx")
        return "slide_deck.pptx"

    def generate_mindmap(self, content: str) -> str:
        # 1. Generate hierarchy with Mistral
        hierarchy = mistral.generate_json(
            f"Create mind map hierarchy from: {content}"
        )

        # 2. Visualize with graphviz
        dot = graphviz.Digraph()
        self._build_graph(dot, hierarchy)
        dot.render('mindmap')
        return 'mindmap.pdf'
```

---

### 3. INFORMATION EXTRACTION MODEL (NEW)

**For Extracting Tables, Figures, Key Findings**

```python
class AdvancedExtractor:
    def extract_entities(self, text: str):
        """Extract key entities, findings, methodologies"""
        # Use spacy or transformers for NER

    def extract_tables(self, content: str, images: List):
        """Extract tables from text and images"""
        # Use paddleOCR or Tesseract for images
        # Use regex for text tables
        # Use table-transformers for complex tables

    def extract_key_findings(self, content: str):
        """Use LLM to extract key findings"""
        # Few-shot with Mistral
```

---

### 4. EMBEDDING STORAGE & RETRIEVAL

**Update ChromaDB or Switch to Vector Store:**
```
Current: Single collection with all embeddings
New: Multi-level organization

Option 1: Stay with ChromaDB
- Create collections per notebook
- Store metadata with source reference
- Use metadata filtering

Option 2: Switch to Weaviate (Better for multi-source)
- Built-in multi-tenancy
- Better filtering
- GraphQL API

Option 3: Use Pinecone (Cloud)
- Managed vector DB
- Namespace support
- Better performance at scale

Recommendation: Stick with ChromaDB but optimize:
```

```python
# Enhanced ChromaDB usage
chroma_client = chromadb.Client()

# Create namespaced collection per notebook
def create_notebook_collection(notebook_id: str):
    return chroma_client.create_collection(
        name=f"notebook_{notebook_id}",
        metadata={
            "notebook_id": notebook_id,
            "created_at": datetime.now()
        }
    )

# Store with rich metadata
collection.add(
    ids=[chunk_id],
    embeddings=[embedding],
    documents=[text],
    metadatas=[{
        "source_id": source_id,
        "source_title": source_title,
        "source_type": source_type,
        "page_number": page,
        "section": section,
        "date_published": date
    }]
)
```

---

## ARCHITECTURE DIAGRAM

### Current
```
PDF Upload → PyMuPDF/pdfplumber → Specter2 Embeddings
→ ChromaDB → Mistral Chat → Response
```

### New
```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  (Dashboard | Notebook | Workspace)                          │
└────────────────┬──────────────────────────────────────────────┘
                 │
┌────────────────┴──────────────────────────────────────────────┐
│                    FASTAPI BACKEND                            │
│  ├─ Notebook Management                                      │
│  ├─ Source Management (PDF, Web, Articles)                   │
│  ├─ Chat/Query Engine                                        │
│  ├─ Action Generation (Audio, Slides, etc.)                  │
│  └─ Export & Search                                          │
└────────┬────────────┬────────────┬─────────────┬──────────────┘
         │            │            │             │
    ┌────▼──┐   ┌────▼──┐   ┌────▼───┐   ┌────▼──────┐
    │Content│   │Vector │   │Metadata│   │ ML Models │
    │Extract│   │ Store │   │Storage │   │(Embeddings│
    │Engine │   │(Chroma)   │(PostgreSQL)│ & LLM)   │
    │┌─────┐│   │      │   │        │   │┌────────┐ │
    ││PyMuPDF   │      │   │        │   ││Specter2 │ │
    ││pdfplumb  │      │   │        │   ││Mistral  │ │
    ││BeautifulS│      │   │        │   ││TTS Model│ │
    ││Selenium  │      │   │        │   ││Sentence │ │
    │└─────┘│   │      │   │        │   ││Transform│ │
    └───────┘   └──────┘   └────────┘   │└────────┘ │
                                         └───────────┘
```

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Week 1-2): Foundation
- [ ] Create Notebook & Source data models
- [ ] Create notebook CRUD endpoints
- [ ] Refactor database schema (PostgreSQL)
- [ ] Update source upload/management endpoints
- [ ] Enhance ChromaDB with metadata

### Phase 2 (Week 3-4): Chat Enhancement
- [ ] Improve source citation tracking
- [ ] Enhance message models with source data
- [ ] Update RAG pipeline with source awareness
- [ ] Implement search endpoints
- [ ] Add filtering capabilities

### Phase 3 (Week 5-6): Action Generation
- [ ] Audio overview generation
- [ ] Quiz generation
- [ ] Report generation
- [ ] Data table extraction
- [ ] Status tracking for async actions

### Phase 4 (Week 7-8): Visual Generation
- [ ] Slide deck generation
- [ ] Mind map generation
- [ ] Infographic generation

### Phase 5 (Ongoing): Optimization
- [ ] Add multiple embedding models
- [ ] Optimize retrieval performance
- [ ] Implement caching
- [ ] Add export functionality
- [ ] Performance monitoring

---

## TECHNOLOGY ADDITIONS NEEDED

### New Dependencies
```
# API & Framework
fastapi==0.104.0
sqlalchemy==2.0.23
pydantic==2.5.0

# Database
psycopg2-binary==2.9.9
alembic==1.12.1

# Multi-source content extraction
beautifulsoup4==4.12.2
selenium==4.14.0
requests==2.31.0

# Multiple embeddings
sentence-transformers==2.2.2

# Visual generation
python-pptx==0.6.21
graphviz==0.20.1
pillow==10.1.0
matplotlib==3.8.2

# Audio/TTS
elevenlabs==0.2.28  # or gTTS

# Data extraction
pandas==2.1.3
openpyxl==3.10.10

# Async task queue
celery==5.3.4
redis==5.0.1
```

### Infrastructure Changes
```
Current:
- FastAPI container
- ChromaDB container
- Model API container

New additions:
- PostgreSQL container (metadata database)
- Redis container (task queue, caching)
- Optional: Milvus/Weaviate (advanced vector DB)
```

---

## KEY CONSIDERATIONS

### Performance
- Implement lazy loading for source lists
- Use async/background tasks for action generation
- Add caching for frequently accessed data
- Batch embedding generation

### Scalability
- Use PostgreSQL instead of in-memory storage
- Implement database indexes on source_id, notebook_id
- Use Redis for caching and task queues
- Consider separate microservice for action generation

### Data Structure
- Keep ChromaDB lightweight (only embeddings + IDs)
- Move metadata to PostgreSQL
- Use PostgreSQL for complex queries
- Maintain relationship between chunks, sources, notebooks

### Multi-Model Strategy
- Keep Specter2 for PDF papers (high quality)
- Use MiniLM for web content (fast)
- Have fallback to universal model
- Version embeddings by model type

---

## MIGRATION STRATEGY

### Without Data Loss
```sql
-- Step 1: Create new tables (run migrations via Alembic)
-- Step 2: Create default notebook for existing documents
INSERT INTO notebooks (title, description, created_at)
VALUES ('Imported Research', 'Auto-imported from old format', NOW());

-- Step 3: Link existing documents to notebook and sources
INSERT INTO sources (notebook_id, title, source_type, file_path, ...)
SELECT nb.id, pdf_title, 'pdf', file_path, ...
FROM documents d
JOIN notebooks nb ON nb.title = 'Imported Research';

-- Step 4: Regenerate embeddings with new chunking strategy
-- Step 5: Test thoroughly before production deployment
```

---

This document is your complete roadmap for backend transformation!
