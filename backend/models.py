from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime, Boolean, JSON, Index, func, text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from pgvector.sqlalchemy import Vector
import uuid
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    notebooks = relationship("Notebook", back_populates="user")
    sources = relationship("Source", back_populates="user")

class Notebook(Base):
    __tablename__ = 'notebooks'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)
    language = Column(String(50), default="Auto-detect")
    notes = Column(Text, nullable=True)
    mindmap = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

    sources = relationship("Source", back_populates="notebook")
    sessions = relationship("Session", back_populates="notebook")
    user = relationship("User", back_populates="notebooks")

class Source(Base):
    __tablename__ = 'sources'
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    notebook_id = Column(String(36), ForeignKey('notebooks.id'), nullable=True)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50), default='pdf')
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=True)
    file_hash = Column(String(64), unique=True, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    page_count = Column(Integer, nullable=True)
    language = Column(String(10), nullable=True)
    status = Column(String(50), default='processing')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

    notebook = relationship("Notebook", back_populates="sources")
    user = relationship("User", back_populates="sources")
    chunks = relationship("DocumentChunk", back_populates="source", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    
    __table_args__ = (
        Index('ix_document_chunks_text_fts', text("to_tsvector('english', text)"), postgresql_using='gin'),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id = Column(String(255), ForeignKey('sources.id', ondelete='CASCADE'))
    notebook_id = Column(String(36), ForeignKey('notebooks.id'))
    text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=True)
    section = Column(String(255), nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    source = relationship("Source", back_populates="chunks")
    embedding = relationship("Embedding", back_populates="chunk", uselist=False, cascade="all, delete-orphan")

class Embedding(Base):
    __tablename__ = 'embeddings'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chunk_id = Column(String(36), ForeignKey('document_chunks.id', ondelete='CASCADE'), unique=True)
    source_id = Column(String(255), ForeignKey('sources.id'), nullable=True)
    embedding = Column(Vector(768)) # Specter2 uses 768 dims
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    chunk = relationship("DocumentChunk", back_populates="embedding")

class Session(Base):
    __tablename__ = 'sessions'
    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    notebook_id = Column(String(36), ForeignKey('notebooks.id'), nullable=True)
    document_id = Column(String(255), nullable=True) # For backward compatibility with single-doc MVP
    document_name = Column(String(255), nullable=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    notebook = relationship("Notebook", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = 'messages'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(255), ForeignKey('sessions.id', ondelete='CASCADE'))
    type = Column(String(50)) # 'user' or 'assistant'
    content = Column(Text)
    sources_cited = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("Session", back_populates="messages")

class Action(Base):
    __tablename__ = 'actions'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notebook_id = Column(String(36), ForeignKey('notebooks.id'))
    action_type = Column(String(50)) # 'audio', 'mindmap', etc.
    status = Column(String(50)) # 'pending', 'processing', 'completed', 'failed'
    input_params = Column(JSONB, nullable=True)
    output_path = Column(Text, nullable=True)
    file_type = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

class ImageIndex(Base):
    """
    Since we store images inside EXTRACT folder, we keep a mapping in DB
    replaces the mongo 'image_indexes' collection.
    """
    __tablename__ = 'image_indexes'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(255), unique=True, index=True)
    images = Column(JSONB, default=[])
