#!/usr/bin/env python3
"""
Migration script to convert Claude conversations.json to opengrove.db format
"""
import json
import sqlite3
import os
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR / "opengrove.db"
CONVERSATIONS_JSON_PATH = SCRIPT_DIR / "conversations.json"

def iso_to_unix_timestamp(iso_string: str) -> int:
    """Convert ISO timestamp to Unix timestamp"""
    dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
    return int(dt.timestamp())

def generate_title(first_message: str) -> str:
    """Generate title from first message"""
    title = first_message.strip()[:50]
    return title if title else "New chat"

def migrate():
    print("Starting migration...")
    print(f"Reading conversations from: {CONVERSATIONS_JSON_PATH}")
    
    # Read Claude conversations.json
    with open(CONVERSATIONS_JSON_PATH, 'r', encoding='utf-8') as f:
        conversations_data = json.load(f)
    
    print(f"Found {len(conversations_data)} conversations to migrate")
    
    # Initialize database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure tables exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New chat',
            model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)
    """)
    
    migrated_conversations = 0
    migrated_messages = 0
    skipped_empty = 0
    
    for conv in conversations_data:
        # Skip conversations with no messages
        if not conv.get('chat_messages') or len(conv['chat_messages']) == 0:
            skipped_empty += 1
            continue
        
        # Determine title
        title = conv.get('name', '').strip()
        if not title:
            first_msg = conv['chat_messages'][0] if conv['chat_messages'] else None
            if first_msg and first_msg.get('text'):
                title = generate_title(first_msg['text'])
            else:
                title = "New chat"
        
        # Insert conversation
        cursor.execute("""
            INSERT OR REPLACE INTO conversations (id, title, model, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            conv['uuid'],
            title,
            'gemini-2.0-flash',  # Default model
            iso_to_unix_timestamp(conv['created_at'])
        ))
        migrated_conversations += 1
        
        # Insert messages
        for msg in conv['chat_messages']:
            if msg.get('text') and msg['text'].strip():
                role = 'user' if msg.get('sender') == 'human' else 'assistant'
                cursor.execute("""
                    INSERT OR REPLACE INTO messages 
                    (id, conversation_id, role, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    msg['uuid'],
                    conv['uuid'],
                    role,
                    msg['text'],
                    iso_to_unix_timestamp(msg['created_at'])
                ))
                migrated_messages += 1
    
    conn.commit()
    conn.close()
    
    print("\nMigration complete!")
    print(f"- Migrated {migrated_conversations} conversations")
    print(f"- Migrated {migrated_messages} messages")
    print(f"- Skipped {skipped_empty} empty conversations")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as error:
        print(f"Migration failed: {error}")
        import traceback
        traceback.print_exc()
        exit(1)
