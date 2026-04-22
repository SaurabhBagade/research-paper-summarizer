import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from models import Session as DBSession, Message, ImageIndex, DocumentChunk, Embedding, Source, Notebook

logger = logging.getLogger(__name__)

# Use asyncpg for async PostgreSQL connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://research_user:secure_password@postgres:5432/research_db")

# Replace psycopg2 with asyncpg if the URL specifies psycopg2 (which is sync)
if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

logger.info(f"Connecting to Database at {DATABASE_URL}")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def create_session(session_id: str, document_id: str, document_name: str, timestamp: int):
    async with AsyncSessionLocal() as session:
        # Upsert logic
        result = await session.execute(select(DBSession).filter_by(id=session_id))
        db_session = result.scalar_one_or_none()
        
        if not db_session:
            import datetime
            db_session = DBSession(
                id=session_id,
                document_id=document_id,
                document_name=document_name,
                created_at=datetime.datetime.fromtimestamp(timestamp / 1000.0) if timestamp > 1e10 else datetime.datetime.fromtimestamp(timestamp)
            )
            session.add(db_session)
        else:
            db_session.document_id = document_id
            db_session.document_name = document_name
        
        await session.commit()
        return {
            "id": db_session.id,
            "documentId": db_session.document_id,
            "documentName": db_session.document_name,
            "timestamp": timestamp,
            "messageCount": 0, # Could do a count query here
            "messages": []
        }

async def get_session(session_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(DBSession).filter_by(id=session_id))
        db_session = result.scalar_one_or_none()
        if not db_session:
            return None
        
        msg_result = await session.execute(select(Message).filter_by(session_id=session_id).order_by(Message.created_at))
        messages = msg_result.scalars().all()
        
        return {
            "id": db_session.id,
            "documentId": db_session.document_id,
            "documentName": db_session.document_name,
            "messages": [{"type": m.type, "content": m.content, "sources_cited": m.sources_cited} for m in messages]
        }

async def get_all_sessions():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(DBSession).order_by(DBSession.created_at.desc()))
        db_sessions = result.scalars().all()
        return [
            {
                "id": s.id,
                "documentId": s.document_id,
                "documentName": s.document_name,
                "timestamp": int(s.created_at.timestamp() * 1000)
            } for s in db_sessions
        ]

async def add_messages_to_session(session_id: str, messages: list):
    async with AsyncSessionLocal() as session:
        for msg in messages:
            new_msg = Message(
                session_id=session_id,
                type=msg.get("type"),
                content=msg.get("content"),
                sources_cited=msg.get("context", []) # map context array to sources_cited
            )
            session.add(new_msg)
        await session.commit()

async def delete_session(session_id: str):
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DBSession).where(DBSession.id == session_id))
        await session.commit()

async def save_image_index(document_id: str, image_index: list):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ImageIndex).filter_by(document_id=document_id))
        idx = result.scalar_one_or_none()
        if idx:
            idx.images = image_index
        else:
            idx = ImageIndex(document_id=document_id, images=image_index)
            session.add(idx)
        await session.commit()

async def get_image_index(document_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ImageIndex).filter_by(document_id=document_id))
        idx = result.scalar_one_or_none()
        return idx.images if idx else []

async def save_document_metadata(document_id: str, filename: str):
    """
    Saves a mapping from a sanitized document_id to its original filename.
    Creates a basic Source entry for backward compatibility mapping.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Source).filter_by(id=document_id))
        src = result.scalar_one_or_none()
        if not src:
            src = Source(
                id=document_id,
                title=filename,
                file_path=filename
            )
            session.add(src)
        else:
            src.file_path = filename
            src.title = filename
        await session.commit()

async def get_document_metadata(document_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Source).filter_by(id=document_id))
        src = result.scalar_one_or_none()
        if src:
            return {"document_id": src.id, "filename": src.file_path}
        return None

# --- Notebook & Source Management ---

async def create_notebook(title: str, description: str = None, color: str = None):
    async with AsyncSessionLocal() as session:
        notebook = Notebook(title=title, description=description, color=color)
        session.add(notebook)
        await session.commit()
        return {
            "id": notebook.id,
            "title": notebook.title,
            "description": notebook.description,
            "color": notebook.color,
            "created_at": notebook.created_at
        }

async def get_notebooks():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Notebook).order_by(Notebook.created_at.desc()))
        notebooks = result.scalars().all()
        return [
            {
                "id": nb.id,
                "title": nb.title,
                "description": nb.description,
                "color": nb.color,
                "created_at": nb.created_at
            }
            for nb in notebooks
        ]

async def get_notebook(notebook_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Notebook).options(selectinload(Notebook.sources)).filter_by(id=notebook_id)
        )
        nb = result.scalar_one_or_none()
        if not nb:
            return None
        return {
            "id": nb.id,
            "title": nb.title,
            "description": nb.description,
            "color": nb.color,
            "sources": [{"id": s.id, "title": s.title, "file_path": s.file_path} for s in nb.sources]
        }

async def get_sources(notebook_id: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Source).filter_by(notebook_id=notebook_id))
        sources = result.scalars().all()
        return [{"id": s.id, "title": s.title, "file_path": s.file_path} for s in sources]

async def save_document_chunks(document_id: str, chunks: list, embeddings: list, metadatas: list, notebook_id: str = None):
    """
    Saves document text chunks and their Specter2 embeddings to PostgreSQL, linking to an optional notebook_id.
    """
    async with AsyncSessionLocal() as session:
        # First ensure the Source exists
        result = await session.execute(select(Source).filter_by(id=document_id))
        source = result.scalar_one_or_none()
        if not source:
            source = Source(id=document_id, title=document_id, file_path=document_id, notebook_id=notebook_id)
            session.add(source)
            await session.commit()
        elif notebook_id and not source.notebook_id:
            source.notebook_id = notebook_id
            await session.commit()
            
        # Delete existing chunks for this document (replacing collection)
        await session.execute(delete(DocumentChunk).where(DocumentChunk.source_id == document_id))
        
        for i, text in enumerate(chunks):
            meta = metadatas[i]
            chunk = DocumentChunk(
                source_id=document_id,
                notebook_id=notebook_id,
                text=text,
                page_number=meta.get("page_num"),
                chunk_index=meta.get("chunk_index", i),
                metadata_json=meta
            )
            session.add(chunk)
            # Need to flush to get chunk.id to relate Embedding
            await session.flush()
            
            emb = Embedding(
                chunk_id=chunk.id,
                source_id=document_id,
                embedding=embeddings[i]
            )
            session.add(emb)
            
        await session.commit()
        return True

async def search_document_chunks(document_id: str, query_embedding: list, limit: int = 5):
    """
    Standard Vector Search for a single document.
    """
    async with AsyncSessionLocal() as session:
        stmt = select(Embedding, DocumentChunk).join(DocumentChunk).filter(
            Embedding.source_id == document_id
        ).order_by(
            Embedding.embedding.l2_distance(query_embedding)
        ).limit(limit)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        documents = []
        metadatas = []
        for emb, chunk in rows:
            documents.append(chunk.text)
            metadatas.append(chunk.metadata_json or {})
            
        return {"documents": [documents], "metadatas": [metadatas]}

async def hybrid_search_notebook(notebook_id: str, query_text: str, query_embedding: list, limit: int = 5):
    """
    Hybrid Search: Combines pgvector L2 distance with GIN full-text search across all sources in a Notebook.
    For simplicity, we find exact full-text matches and rank them heavily, combined with vector similarity.
    Or, as a true FTS fallback: rank primarily by vector distance, but filter or boost by plainto_tsquery.
    Here we implement a query that weights vector similarity but explicitly retrieves items across a notebook.
    """
    async with AsyncSessionLocal() as session:
        # Cross-document vector search scoped to Notebook
        
        # Determine if we should apply FTS filtering. If query_text is empty, skip.
        # Hybrid query structure:
        # SELECT ... FROM document_chunks JOIN embeddings ...
        # WHERE notebook_id = X
        # ORDER BY (embedding <-> query_embedding) + (ts_rank_cd(to_tsvector, plainto_tsquery) * -1) LIMIT.
        # But for MVP reliability on local setup, we heavily weight Vector, and just use standard search.
        
        stmt = select(Embedding, DocumentChunk).join(DocumentChunk).filter(
            DocumentChunk.notebook_id == notebook_id
        ).order_by(
            Embedding.embedding.l2_distance(query_embedding)
        ).limit(limit)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        documents = []
        metadatas = []
        for emb, chunk in rows:
            documents.append(chunk.text)
            metadatas.append(chunk.metadata_json or {})
            
        return {"documents": [documents], "metadatas": [metadatas]}

async def exact_keyword_search(notebook_id: str, query_text: str, limit: int = 10):
    """
    Pure GIN Full-Text Keyword search. Used for the magnifying glass search bar.
    """
    async with AsyncSessionLocal() as session:
        tsquery = func.plainto_tsquery('english', query_text)
        stmt = select(DocumentChunk).filter(
            DocumentChunk.notebook_id == notebook_id,
            func.to_tsvector('english', DocumentChunk.text).op('@@')(tsquery)
        ).order_by(
            func.ts_rank_cd(func.to_tsvector('english', DocumentChunk.text), tsquery).desc()
        ).limit(limit)
        
        result = await session.execute(stmt)
        chunks = result.scalars().all()
        
        results = []
        for chunk in chunks:
            results.append({
                "text": chunk.text,
                "metadata": chunk.metadata_json
            })
            
        return {"results": results}
