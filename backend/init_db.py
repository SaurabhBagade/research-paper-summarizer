import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from models import Base
from db import DATABASE_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        logger.info("Creating extensions if not exist...")
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector;'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto;'))
        
        logger.info("Dropping old tables (safe wipe for schema update)...")
        await conn.run_sync(Base.metadata.drop_all)

        logger.info("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    logger.info("Database initialized successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_db())
