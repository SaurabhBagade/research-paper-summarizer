import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.research_assistant

async def create_session(session_id: str, document_id: str, document_name: str, timestamp: int):
    session = {
        "id": session_id,
        "documentId": document_id,
        "documentName": document_name,
        "timestamp": timestamp,
        "messageCount": 0,
        "messages": []
    }
    # Upsert in case it exists to avoid duplicates if frontend retries
    await db.sessions.update_one(
        {"id": session_id}, 
        {"$set": session}, 
        upsert=True
    )
    return session

async def get_session(session_id: str):
    return await db.sessions.find_one({"id": session_id}, {"_id": 0})

async def get_all_sessions():
    cursor = db.sessions.find({}, {"_id": 0}).sort("timestamp", -1)
    sessions = await cursor.to_list(length=100)
    return sessions

async def add_messages_to_session(session_id: str, messages: list):
    """
    Appends multiple messages to the session's message array 
    and updates the messageCount.
    """
    await db.sessions.update_one(
        {"id": session_id},
        {
            "$push": {"messages": {"$each": messages}},
            "$inc": {"messageCount": len(messages)}
        }
    )

async def delete_session(session_id: str):
    await db.sessions.delete_one({"id": session_id})
