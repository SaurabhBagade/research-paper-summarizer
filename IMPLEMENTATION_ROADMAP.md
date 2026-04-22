# Implementation Roadmap: NotebookLM UI - PDF-Only Version

## KEY CHANGES FROM FULL VERSION

### Scope Reduction (Phase 1 MVP)

**REMOVED (Not in MVP):**
```
❌ Web scraping (BeautifulSoup, Selenium)
❌ Article/Blog sources
❌ URL source management
❌ Multi-model embeddings (keep only Specter2)
❌ Dynamic content extraction
❌ Slides generation
❌ Quiz generation
❌ Reports generation
❌ Infographic generation
❌ Data Table extraction
```

**KEPT (MVP Version):**
```
✅ PDF uploads
✅ Notebook organization
✅ Enhanced chat with source citations
✅ Full-text search across PDFs
✅ Dashboard with notebooks
✅ Source library (PDF files only)
✅ Action generation - AUDIO OVERVIEW ONLY
✅ Action generation - MIND MAP ONLY
```

**DEFERRED (Future Version 2.0):**
```
🔮 Slides generation
🔮 Quiz generation
🔮 Reports generation
🔮 Infographic generation
🔮 Data Table extraction
```

### Impact on Timeline
- **Reduced complexity by ~60-65%** (vs full version)
- **MVP now achievable in 2-3 weeks**
- **Simpler action generation**
- **Clear upgrade path for future actions**
- **Faster time to market**

---

## DATABASE CHOICE: POSTGRESQL (CONFIRMED)

**Why PostgreSQL is optimal for this application:**

1. ✅ **Full-text search** (built-in, free, fast)
   - Critical for searching across PDFs
   - PostgreSQL native > MongoDB Atlas paid

2. ✅ **Vector embeddings** (pgvector extension)
   - Specter2 embeddings (768-dim)
   - Free extension, integrated with relational data
   - MongoDB: Would require paid Atlas Vector Search

3. ✅ **Relational data modeling**
   - Notebooks → Sources → Chunks → Embeddings
   - Native JOIN support vs MongoDB complexity

4. ✅ **ACID transactions**
   - Data consistency guaranteed
   - Critical when uploading/processing PDFs

5. ✅ **Cost**
   - 3-5x cheaper than MongoDB Atlas
   - $20-30/month vs $57+/month

**See `DATABASE_COMPARISON.md` for detailed analysis**

---

## SIMPLIFIED DATABASE SCHEMA

### PostgreSQL Tables (Reduced)

```sql
-- Notebooks table (same)
CREATE TABLE notebooks (
    id UUID PRIMARY KEY,
    owner_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Sources table (SIMPLIFIED - PDF only)
CREATE TABLE sources (
    id UUID PRIMARY KEY,
    notebook_id UUID REFERENCES notebooks(id),
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) DEFAULT 'pdf',  -- Always 'pdf'
    file_path TEXT NOT NULL,  -- Local path to PDF
    file_size INT,  -- File size in bytes
    file_hash VARCHAR(64),  -- SHA256 for deduplication
    metadata JSONB,  -- PDF metadata (author, creation date, etc.)
    page_count INT,
    language VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    INDEX idx_notebook (notebook_id),
    UNIQUE(file_hash)  -- Prevent duplicate uploads
);

-- Document chunks table (SIMPLIFIED)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id),
    text LONGTEXT NOT NULL,
    page_number INT,
    chunk_index INT,
    section VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP,
    INDEX idx_source (source_id),
    INDEX idx_notebook (notebook_id),
    INDEX idx_page (page_number)
);

-- Embeddings table (SIMPLIFIED - only Specter2)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id),
    embedding VECTOR(768),  -- Only Specter2 (768-dim)
    created_at TIMESTAMP,
    UNIQUE(chunk_id),
    INDEX idx_source (source_id)
);

-- Messages table (same as before)
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id UUID,
    type VARCHAR(50),  -- user, assistant
    content LONGTEXT,
    sources_cited JSONB,  -- Array of source citations
    created_at TIMESTAMP,
    INDEX idx_session (session_id)
);

-- Sessions/Chats table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    notebook_id UUID REFERENCES notebooks(id),
    title VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    INDEX idx_notebook (notebook_id)
);

-- Actions table (same)
CREATE TABLE actions (
    id UUID PRIMARY KEY,
    notebook_id UUID REFERENCES notebooks(id),
    action_type VARCHAR(50),  -- audio, slides, mindmap, quiz, report, etc.
    status VARCHAR(50),  -- pending, processing, completed, failed
    input_params JSONB,
    output_path TEXT,
    file_type VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    INDEX idx_notebook (notebook_id),
    INDEX idx_status (status)
);
```

---

## SIMPLIFIED API ENDPOINTS

### Notebook Management (5 endpoints)
```
POST   /api/notebooks                    # Create notebook
GET    /api/notebooks                    # List all notebooks
GET    /api/notebooks/{notebook_id}      # Get notebook details
PUT    /api/notebooks/{notebook_id}      # Update notebook
DELETE /api/notebooks/{notebook_id}      # Delete notebook
```

### Source Management - PDF ONLY (5 endpoints, instead of 8)
```
POST   /api/sources/upload               # Upload PDF file
GET    /api/sources/{notebook_id}        # List PDFs in notebook
GET    /api/sources/{source_id}          # Get PDF details
PUT    /api/sources/{source_id}          # Update PDF metadata
DELETE /api/sources/{source_id}          # Delete PDF
```

**Request Example:**
```json
POST /api/sources/upload
{
  "notebook_id": "nb-123",
  "file": <binary_pdf>,
  "title": "Research Paper Title (optional)"
}

Response:
{
  "id": "src-456",
  "title": "Research Paper Title",
  "page_count": 45,
  "file_size": 5242880,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Chat/Query (2 endpoints)
```
POST   /api/chat                         # Send message (enhanced with sources)
GET    /api/session/{session_id}         # Get session with messages
```

### Action Generation (2 endpoints - MVP only)
```
POST   /api/actions/audio                # Generate audio overview
POST   /api/actions/mindmap              # Generate mind map visualization

GET    /api/actions/{action_id}/status   # Check status
GET    /api/actions/{action_id}/download # Download result
```

### Search (1 endpoint)
```
GET    /api/search                       # Full-text search across PDFs
```

**TOTAL: 16 API endpoints (MVP)**
Future expansion: +5 more endpoints for other 5 actions in V2.0

---

## TECHNOLOGY STACK (PostgreSQL + PDF-Only)

### Database & ORM
```
✅ PostgreSQL 13+              # Main database
✅ psycopg2-binary==2.9.9     # PostgreSQL driver
✅ sqlalchemy==2.0.23         # ORM
✅ alembic==1.12.1            # Migrations
✅ pgvector==0.2.4            # Vector extension for embeddings
```

### Backend & API
```
✅ fastapi==0.104.0           # REST API framework
✅ pydantic==2.5.0            # Data validation
✅ python-multipart==0.0.6    # File uploads
```

### Vector & ML
```
✅ chromadb==0.4.17           # Vector store (local)
✅ sentence-transformers==2.2.2  # Only Specter2 (no multi-model)
✅ numpy==1.24.3              # Numeric operations
```

### PDF Processing
```
✅ PyMuPDF==1.23.5            # PDF extraction (current choice)
OR
✅ pdfplumber==0.10.3         # Alternative PDF extraction
```

### Async Task Queue
```
✅ celery==5.3.4              # Async job processing
✅ redis==5.0.1               # Message broker + caching
```

### Action Generation Libraries (MVP Only)
```
✅ elevenlabs==0.2.28         # Audio TTS (recommended)
   OR gTTS==2.3.2             # Free TTS alternative
✅ graphviz==0.20.1           # Mind map visualization
```

### Future Action Libraries (Deferred to V2.0)
```
🔮 python-pptx==0.6.21        # Slides (v2.0)
🔮 pillow==10.1.0             # Infographics (v2.0)
🔮 matplotlib==3.8.2          # Charting (v2.0)
🔮 pandas==2.1.3              # Data tables (v2.0)
```

### Utilities
```
✅ python-dotenv==1.0.0       # Environment variables
✅ pyyaml==6.0.1              # Config files
```

### Removed (Not Needed)
```
❌ beautifulsoup4       # Web scraping (PDF-only)
❌ selenium             # Browser automation (PDF-only)
❌ requests             # HTTP calls (PDF-only)
❌ Tesseract/PaddleOCR  # Image OCR (not required for PDFs)
```

---

## SIMPLIFIED DATA MODELS

### Source Model (Simplified)
```python
class Source(BaseModel):
    id: str
    notebook_id: str
    title: str
    file_path: str  # Only local path
    file_size: int
    file_hash: str  # For deduplication
    page_count: int
    metadata: Dict  # PDF metadata extracted
    created_at: datetime
    updated_at: datetime

class SourceMetadata(BaseModel):
    author: Optional[str]
    creation_date: Optional[str]
    subject: Optional[str]
    keywords: Optional[List[str]]
```

### Embedding Manager (Simplified)
```python
class EmbeddingManager:
    def __init__(self):
        # Only Specter2, no model selection needed
        self.model = SentenceTransformer('allenai/specter2_base')

    def get_embeddings(self, text: str) -> List[float]:
        return self.model.encode(text).tolist()

    @staticmethod
    def get_dimension() -> int:
        return 768  # Always 768 for Specter2
```

---

## WORK BREAKDOWN - SIMPLIFIED

### PHASE 1: FOUNDATIONS

#### Work Stream A: PostgreSQL Database Setup
- [ ] PostgreSQL 13+ installation & configuration
- [ ] Install pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Create Alembic migration structure
- [ ] Write migrations for 7 tables (notebooks, sources, chunks, embeddings, messages, sessions, actions)
- [ ] Add functional indexes:
  - [ ] GIN index on document_chunks.text for full-text search
  - [ ] IVFFlat index on embeddings.embedding for vector similarity
  - [ ] B-tree indexes on foreign keys (notebook_id, source_id)
- [ ] Create database roles & access controls
- [ ] Verify pgvector vector dimension (768 for Specter2)

**Effort: 4-5 hours** (includes pgvector setup)

#### Work Stream B: Data Models
- [ ] Pydantic models (Notebook, Source, Session, Message)
- [ ] SQLAlchemy ORM models
- [ ] API schemas
- **Effort: 3-4 hours** ⬇️ (reduced from 5-7)

#### Work Stream C: Frontend Dashboard
- [ ] Dashboard layout & responsive design
- [ ] Notebook cards (featured + recent)
- [ ] Create notebook modal
- **Effort: 6-8 hours** (same)

#### Work Stream D: PDF Processing Pipeline
- [ ] PDF extraction (PyMuPDF/pdfplumber - reuse current)
- [ ] Chunking strategy (keep current)
- [ ] Specter2 embedding setup (reuse current)
- [ ] ChromaDB storage (reuse current)
- **Effort: 2-3 hours** ⬇️ (reduced from 4-5, just simplifications)

**Phase 1 Total: ~15-20 hours** (includes pgvector extension setup)

---

### PHASE 2: NOTEBOOK & SOURCE MANAGEMENT

#### Work Stream A: Notebook CRUD API
- [ ] Create, Read, Update, Delete, List endpoints
- [ ] PostgreSQL integration
- [ ] Error handling
- **Effort: 4-5 hours**

#### Work Stream B: PDF Upload & Management API
- [ ] POST /api/sources/upload (with file validation)
- [ ] GET /api/sources/{notebook_id} (list PDFs)
- [ ] GET/PUT/DELETE individual sources
- [ ] File hash deduplication
- [ ] Metadata extraction from PDF
- **Effort: 6-8 hours** ⬇️ (was 12-16, no web scraping!)

#### Work Stream C: Frontend - Left Pane (Source Library)
- [ ] PDF list component
- [ ] PDF item card with metadata
- [ ] Upload modal with drag-drop
- [ ] Selection management
- **Effort: 6-8 hours**

#### Work Stream D: ChromaDB Integration
- [ ] Namespace per notebook (already done in current app)
- [ ] Store embeddings with source tracking
- [ ] Metadata storage
- **Effort: 2-3 hours**

**Phase 2 Total: ~18-24 hours** ⬇️ (was 28-38)

---

### PHASE 3: CHAT ENHANCEMENT & SOURCE TRACKING

#### Work Stream A: Enhanced Chat API
- [ ] Update POST /api/chat for source tracking
- [ ] Improved RAG prompt with citations
- [ ] Message storage with sources_cited
- **Effort: 5-6 hours**

#### Work Stream B: Frontend - Center Pane (Chat)
- [ ] Chat message bubbles (user + assistant)
- [ ] Source citation badges
- [ ] Input field with controls
- [ ] Message history
- **Effort: 8-10 hours**

#### Work Stream C: Search API
- [ ] Full-text search across PDFs
- [ ] Filter by date, notebook
- [ ] Relevance ranking
- **Effort: 3-4 hours** ⬇️ (simpler without web sources)

#### Work Stream D: UI Connections
- [ ] Source highlighting when cited
- [ ] Click source → scroll to messages
- [ ] Visual connections
- **Effort: 4-5 hours**

**Phase 3 Total: ~20-25 hours** (similar, but faster due to less complexity)

---

### PHASE 4: ACTION GENERATION (MVP - 2 Actions Only)

#### Work Stream A: Async Infrastructure
- [ ] Redis container
- [ ] Celery setup
- [ ] Task queue base classes
- [ ] Status tracking
- **Effort: 3-4 hours**

#### Work Stream B: Action Generators (MVP Only)

**B1: Audio Overview** (Podcast-style)
- [ ] Content summarization with Mistral
- [ ] TTS integration (elevenlabs/gTTS)
- [ ] MP3/WAV generation
- [ ] Audio player integration
- **Effort: 4-6 hours**

**B2: Mind Map Generation**
- [ ] Hierarchical structure from PDF
- [ ] Graphviz visualization
- [ ] SVG/PDF output
- [ ] Interactive viewer
- **Effort: 3-4 hours**

**Phase 4B Total: ~10-14 hours** (MVP only - 2 actions)

**Deferred to V2.0 (Future):**
```
🔮 Slides generation (4-5 hours)
🔮 Quiz generation (3-4 hours)
🔮 Reports generation (4-5 hours)
🔮 Infographics generation (4-5 hours)
🔮 Data table extraction (2-3 hours)
Total deferred: ~17-22 hours
```

#### Work Stream C: Frontend - Right Pane (Action Hub)
- [ ] 2 Action card components (Audio + Mind Map only)
- [ ] Status tracking UI
- [ ] Download buttons
- **Effort: 4-6 hours**

#### Work Stream D: File Storage
- [ ] Local file storage setup
- [ ] Download endpoints
- [ ] Cleanup policies
- **Effort: 2-3 hours**

**Phase 4 Total (MVP): ~22-31 hours** (was 40-50 hours)

---

### TESTING & QA

- [ ] Unit tests (models, utilities): 3-4 hours
- [ ] Integration tests (API endpoints): 4-6 hours
- [ ] End-to-end testing (workflows): 4-6 hours
- [ ] Audio generation testing: 2-3 hours
- [ ] Mind map generation testing: 2-3 hours
- [ ] Bug fixes & debugging: 4-6 hours

**Testing Total: ~19-28 hours** (reduced from 20-25)

---

## DEVOPS & DEPLOYMENT - PostgreSQL Specific

### PostgreSQL Container Setup
```yaml
# docker-compose.yml snippet for PostgreSQL + pgvector
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16-latest  # Includes pgvector pre-installed
    environment:
      POSTGRES_USER: research_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: research_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    networks:
      - app-network

  celery_worker:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    depends_on:
      - redis
      - postgres
    environment:
      DATABASE_URL: postgresql://research_user:secure_password@postgres:5432/research_db
      REDIS_URL: redis://redis:6379/0
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
```

### PostgreSQL Initialization Script
```sql
-- init.sql: Run after PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify extensions
SELECT * FROM pg_extension
WHERE extname IN ('uuid-ossp', 'vector', 'pgcrypto');
```

### Setup Checklist
- [ ] PostgreSQL 13+ with pgvector installed (use pgvector/pgvector Docker image)
- [ ] Create database and user
- [ ] Enable UUID, vector, and pgcrypto extensions
- [ ] Run Alembic migrations to create all tables
- [ ] Create GIN index for full-text search
- [ ] Create IVFFlat index for vector similarity
- [ ] Redis container running (for Celery task queue)
- [ ] Verify pgvector version: `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
- [ ] Test vector operations: `SELECT '[0.1, 0.2, 0.3]'::vector <-> '[0.4, 0.5, 0.6]'::vector;`

### Effort Breakdown
- [ ] PostgreSQL setup: 2 hours
- [ ] pgvector extension setup: 1 hour
- [ ] Alembic migrations & schema: 3 hours
- [ ] Redis + Celery config: 2-3 hours
- [ ] Docker Compose optimization: 2-3 hours
- [ ] Deployment guide: 2-3 hours
- [ ] Local development environment setup: 2 hours

**DevOps Total: ~12-16 hours**

---

---

### DOCUMENTATION

- [ ] Code comments: 3-4 hours
- [ ] API documentation: 2-3 hours
- [ ] Database schema docs: 1-2 hours
- [ ] Deployment guide: 2-3 hours

**Docs Total: ~8-12 hours**

---

## TOTAL EFFORT ESTIMATE - PostgreSQL + PDF-Only + MVP Actions (Audio + Mind Map)

```
Phase 1 (Foundations):   15-20 hours    (PostgreSQL + pgvector setup)
Phase 2 (Notebook+PDF):  18-24 hours    (CRUD + PDF management)
Phase 3 (Chat):          20-25 hours    (Source tracking + search)
Phase 4 (2 Actions):     22-31 hours    (Audio + Mind Map only)
Testing:                 19-28 hours    (MVP testing)
DevOps:                  12-16 hours    (Docker + PostgreSQL)
Docs:                    8-12 hours     (PostgreSQL docs included)
─────────────────────────────────────
TOTAL (MVP):            114-156 hours
```

### Roadmap: MVP vs Future Expansion

| Component | MVP (V1.0) | Future (V2.0) | Notes |
|-----------|----------|--------------|-------|
| Notebook management | ✅ | - | Core feature |
| PDF upload & management | ✅ | - | Core feature |
| Chat with citations | ✅ | - | Core feature |
| Full-text search | ✅ | - | Core feature |
| Audio overview | ✅ | Enhanced | MVP ready |
| Mind map generation | ✅ | Enhanced | MVP ready |
| Slides generation | 🔮 | ✅ | +4-5 hrs |
| Quiz generation | 🔮 | ✅ | +3-4 hrs |
| Report generation | 🔮 | ✅ | +4-5 hrs |
| Infographics | 🔮 | ✅ | +4-5 hrs |
| Data tables | 🔮 | ✅ | +2-3 hrs |
| **TOTAL** | **114-156 hrs** | **+17-22 hrs** | Clear upgrade path |

### Comparison: Full vs PDF-Only vs MVP

| Metric | Full Version | PDF-Only | MVP (2 Actions) | Savings |
|--------|------------|----------|----------------|---------|
| Total hours | 126-163 hrs | 133-172 hrs | **114-156 hrs** | **-10-20%** |
| Calendar days (solo) | ~25-33 days | 25-30 days | **18-25 days** | **-25-30%** ⬇️ |
| API endpoints | 24 | 20 | **16** | **-33%** |
| Actions | 7 | 7 | **2** | **-71%** ⬇️ |
| Libraries | High | Medium | **Low** | **-40%** |
| deployment complexity | High | Medium | **Low** | **-50%** |

---

## CALENDAR TIMELINE - PostgreSQL + PDF-Only

### Working Solo (4-6 hrs/day focus)
```
133-172 hours ÷ 5.5 hours/day = 24-31 calendar days

REALISTIC: 25-30 calendar days

(With PostgreSQL FTS "for free" vs MongoDB complexity)
```

### With 2 Developers (Backend + Frontend parallel)
```
Backend: ~50-65 hours
Frontend: ~25-35 hours
Optimized parallelization: 45-65% time reduction

REALISTIC: 12-16 calendar days
```

### With Designer + 2 Developers (Full parallelization)
```
All can work in parallel after initial setup

REALISTIC: 10-14 calendar days
```

### Part-time (2 hrs/day)
```
93-133 hours ÷ 2 hours/day = 47-67 calendar days

REALISTIC: 50-60 calendar days
```

---

## 🚀 PRE-IMPLEMENTATION CHECKLIST

**Complete BEFORE starting Phase 1 development:**

### Infrastructure
- [ ] PostgreSQL 13+ with pgvector installed (Docker recommended)
- [ ] Redis server running
- [ ] Python 3.10+ environment with venv/conda
- [ ] Docker & Docker Compose installed

### Configuration
- [ ] Clone repository and setup git
- [ ] Create `.env` file with database credentials
- [ ] Install Python dependencies: `pip install -r requirements.txt`
- [ ] Verify PostgreSQL connection works
- [ ] Verify Redis connection works

### Database
- [ ] PostgreSQL connection string verified
- [ ] pgvector extension confirmed installed
- [ ] Alembic initialized in project

### Design
- [ ] Figma designs finalized and shared
- [ ] API endpoint specifications reviewed
- [ ] Data model review complete

### TTS Service Decision
- [ ] Decide: elevenlabs (paid, quality) or gTTS (free)
- [ ] If elevenlabs: API key obtained and stored in `.env`

### PDF Library Decision
- [ ] Confirm PyMuPDF or pdfplumber
- [ ] Test with sample PDFs

### Team Alignment
- [ ] Team understands scope (PDF-only, PostgreSQL, 7 actions)
- [ ] Timeline expectations set (25-30 calendar days solo)
- [ ] MVP vs Full Feature decision made

---

## SIMPLIFIED IMPLEMENTATION PHASES - PostgreSQL Optimized

### PHASE 1 (Days 1-3): Core Setup
- PostgreSQL schema creation
- API models & scaffolding
- PDF extraction pipeline validation
- Frontend dashboard skeleton

**Blockers**: None - **Can start immediately**

---

### PHASE 2 (Days 4-8): Notebook & PDF Management
- Notebook CRUD endpoints
- PDF upload/management endpoints
- Source library UI
- File deduplication & validation

**Blockers**: Phase 1 complete

---

### PHASE 3 (Days 9-13): Chat Enhancement
- Enhanced chat with source citations
- Message storage with sources_cited
- Chat UI implementation
- Full-text search

**Blockers**: Phase 2 complete

---

### PHASE 4 (Days 14-20): Action Generation
- Async infrastructure (Redis + Celery)
- 7 Action generators (parallel development)
- Action UI components
- File storage & downloads

**Blockers**: Phase 1 complete (can start partially in parallel)

---

### PHASE 5 (Days 21-25): Testing & Polish
- Comprehensive testing
- Bug fixes
- Performance optimization
- Documentation

**Blockers**: Phase 4 complete

---

## DEPENDENCY GRAPH - SIMPLIFIED

```
Phase 1 (DB + Setup)
    ├─ Phase 2 (Notebooks + PDF CRUD)
    │   └─ Phase 3 (Chat Enhancement)
    │
    └─ Phase 4A (Async Infrastructure)
        └─ Phase 4B (Action Generators) ← Can partially start in Phase 1
            └─ Phase 5 (Testing)
```

---

## WHAT AFFECTS YOUR TIMELINE NOW

### Factors that make it FASTER:
✅ PDF-only scope (no web scraping complexity)
✅ Single embedding model (Specter2 only)
✅ MVP: Only 2 actions (Audio + Mind Map) - deferred 5 to V2.0
✅ Simpler database design
✅ Fewer API endpoints (16 for MVP)
✅ No content extraction libraries needed
✅ Clear, focused requirements
✅ Reduced action complexity (no slides, quiz, reports, infographics, data tables in MVP)

### Factors that might slow it:
❌ Waiting on Figma designs
❌ Large PDF handling issues
❌ Action generation complexity
❌ External TTS service integration
❌ Performance tuning for large notebooks

---

## MY RECOMMENDATIONS

### ✅ Option 1: MVP (CHOSEN FOR V1.0) - 18-25 calendar days
**Minimum Viable Product: Core + 2 Actions**
- ✅ Notebook organization & dashboard
- ✅ PDF upload & management (Source Library)
- ✅ Chat with source citations (Full-text search)
- ✅ Audio Overview generation (Action 1)
- ✅ Mind Map generation (Action 2)
- 🔮 Deferred to V2.0: Slides, Quiz, Reports, Infographics, Data Tables

**Effort: 114-156 hours (solo developer)**

**Approx Timeline:**
- Week 1: Core features (Notebook + PDF + Chat) - ~5-6 days
- Week 2-3: Audio + Mind Map actions - ~7-8 days
- Week 3: Testing & optimization & deployment - ~3-4 days

---

### 🔮 Option 2: Future (V2.0) - Add Later
**Additional 5 actions** (approx +17-22 hours)
- Slides generation (+4-5 hrs)
- Quiz generation (+3-4 hrs)
- Reports generation (+4-5 hrs)
- Infographics (+4-5 hrs)
- Data Tables (+2-3 hrs)

**These can be added incrementally after MVP launch**

---

## IMMEDIATE ACTION ITEMS - READY TO START

### Confirm These Before Phase 1:
1. ✅ **PostgreSQL + pgvector setup**: Is Docker container running?
2. ✅ **Redis setup**: Is Redis container running?
3. ✅ **Python environment**: Python 3.10+ available?
4. ✅ **Scope**: PDF-only confirmed + MVP with 2 actions (Audio + Mind Map)?
5. ✅ **TTS choice**: elevenlabs ($) or gTTS (free)?
6. ✅ **Figma designs**: Ready or still in progress?

### What I Can Start TODAY:
With PostgreSQL + PDF-only scope confirmed, I can generate:

**Option A - Backend First (Recommended)**
- [ ] PostgreSQL Alembic migrations (all 7 tables)
- [ ] Pydantic & SQLAlchemy models
- [ ] API endpoint scaffolding (16 endpoints MVP)
- [ ] PDF processing pipeline refactor
- [ ] Specter2 embedding manager
- [ ] Celery task queue setup
- [ ] Audio generation handler
- [ ] Mind map generation handler

**Option B - Frontend First** (if designs ready)
- [ ] React component structure
- [ ] Dashboard components
- [ ] Notebook CRUD forms
- [ ] PDF upload modal
- [ ] Integration hooks for APIs

**Option C - Both in Parallel** (fastest)
- Run both Option A + Option B simultaneously
- Estimated: Start Phase 1 coverage in parallel

---

## WHAT I'LL GENERATE FOR YOU

### Phase 1 - Foundations (PostgreSQL + Models)

**Backend Files:**
```
backend/
├── models/
│   ├── database.py          # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   └── enums.py             # Enum definitions
├── database/
│   ├── base.py              # Database initialization
│   ├── migrations/          # Alembic migrations
│   │   ├── versions/
│   │   │   └── 001_initial_schema.py
│   │   └── env.py
│   └── init_db.py           # Database setup script
├── core/
│   ├── config.py            # Configuration from .env
│   └── embeddings.py        # Specter2 embedding manager
└── main.py                  # FastAPI app initialization
```

**Frontend Files:**
```
frontend/src/
├── components/
│   ├── Dashboard/
│   │   ├── NotebookCard.tsx
│   │   ├── DashboardGrid.tsx
│   │   └── CreateNotebookModal.tsx
│   ├── Workspace/
│   │   ├── LeftPane/SourceLibrary.tsx
│   │   ├── CenterPane/ChatInterface.tsx
│   │   └── RightPane/ActionHub.tsx
│   └── Layout/Header.tsx
└── hooks/
    └── useNotebook.ts
```

### Phase 2 - CRUD Endpoints (20 endpoints)

**Notebook Endpoints** (5):
```
POST   /api/notebooks              # Create
GET    /api/notebooks              # List
GET    /api/notebooks/{id}         # Get one
PUT    /api/notebooks/{id}         # Update
DELETE /api/notebooks/{id}         # Delete
```

**Source Endpoints** (5):
```
POST   /api/sources/upload         # Upload PDF
GET    /api/sources/{notebook_id}  # List PDFs
GET    /api/sources/{id}           # Get details
PUT    /api/sources/{id}           # Update metadata
DELETE /api/sources/{id}           # Delete
```

**Chat Endpoints** (2):
```
POST   /api/chat                   # Send message
GET    /api/sessions/{id}          # Get session
```

**Action Endpoints** (7):
```
POST   /api/actions/audio          # Audio generation
POST   /api/actions/slides         # Slides generation
POST   /api/actions/mindmap        # Mind map generation
POST   /api/actions/quiz           # Quiz generation
POST   /api/actions/report         # Report generation
POST   /api/actions/infographic    # Infographic generation
POST   /api/actions/data-table     # Data table extraction
```

**Search Endpoint** (1):
```
GET    /api/search                 # Full-text search
```

### Phase 3 - Infrastructure & Testing

**Docker Setup:**
```
docker-compose.yml          # PostgreSQL + Redis + Celery
.env.example               # Environment template
Dockerfile                 # Backend container
```

**Database Migrations:**
(Alembic will generate all `versions/*.py` files automatically)

**Configuration Files:**
```
requirements.txt           # Python dependencies
setup.cfg                 # Project setup
pyproject.toml            # Project metadata
```

---

## FINAL STATUS: READY TO BUILD

### ✅ CONFIRMED SCOPE
- Frontend: NotebookLM-inspired UI (React + Shadcn UI)
- Backend: FastAPI with PostgreSQL + pgvector
- Database: PostgreSQL with pgvector for vector embeddings
- Embeddings: Specter2 only (768-dim)
- Sources: PDF uploads only (no web scraping)
- Actions: 7 generators (Audio, Slides, Mind Map, Quiz, Report, Infographic, Data Table)
- Search: PostgreSQL full-text search (FTS)
- Task Queue: Redis + Celery for async operations

### ✅ TIMELINE CONFIRMED
- **Solo (5 hrs/day)**: 25-30 calendar days
- **2 Developers**: 12-16 calendar days
- **Full Team**: 10-14 calendar days

### ✅ TECHNOLOGY STACK LOCKED
- PostgreSQL 13+ with pgvector
- FastAPI + SQLAlchemy + Alembic
- React + TypeScript + Shadcn UI
- Celery + Redis
- Specter2 embeddings
- Ollama (Mistral 7B locally)

### 🚀 NEXT STEP

**Tell me:**
1. Infrastructure ready? (PostgreSQL + Redis running)
2. Action priority? (which 3 for MVP?)
3. Start with: Backend / Frontend / Both in Parallel?

**Then I'll immediately start generating Phase 1 code!**

---
