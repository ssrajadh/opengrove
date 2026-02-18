# OpenGrove

Local-first AI chat app with conversation branching and RAG-powered long-term memory. React + TypeScript + Tailwind, runs on localhost.

## Setup

better-sqlite3 is a native addon and needs build tools (`build-essential`, `python3`) on Linux. On Ubuntu: `sudo apt install build-essential`.

```bash
cd app && npm install
cp .env.example .env
# Edit .env:
#   GEMINI_API_KEY  — https://aistudio.google.com/apikey
#   OPENAI_API_KEY  — https://platform.openai.com/api-keys (also used for embeddings)
```

**Run from repo root:**

```bash
npm run dev
```

**Or from app directory:**

```bash
cd app && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **`.env`** can live at repo root or in `app/`; the app loads `../.env` when running from `app/`.
- **Data** is stored in `opengrove.db` (SQLite) at the repo root.

## Features

- **Multi-model chat**: Gemini 2.0/3.x Flash & Pro, GPT-4o, GPT-4o Mini, GPT-4.1, GPT-4.1 Mini. User messages on the right, AI on the left.
- **Web search**: Gemini uses Google Search grounding; OpenAI uses Responses API with `web_search_preview`.
- **Streaming**: Real-time NDJSON streaming for both providers.
- **Sidebar**: Conversation history with nested branch tree. "New chat" starts a new thread.
- **Conversation branching**: Hover any message → click "⑂ Branch" to fork the conversation from that point. Branches appear indented under the parent chat in the sidebar. Unlimited nesting depth (indentation caps at 4 levels visually).
- **Token windowing**: Messages sent to the LLM are trimmed to fit the model's context window. User/assistant pairs are never split. Older messages overflow into the RAG pipeline.
- **RAG (Retrieval-Augmented Generation)**: Overflow messages are chunked, embedded (OpenAI `text-embedding-3-small`), and stored in a sqlite-vec virtual table. On each new message, relevant chunks are retrieved and injected as context. Branch-aware: retrieval searches the current conversation and all ancestors, respecting branch points.
- **Embedding model tracking**: An `embedding_config` table stores the active model name and dimensions. Changing the embedding model automatically wipes stale vectors and re-embeds on next use.
- **Storage**: Conversations, messages, embeddings, and vector chunks all in `opengrove.db` (SQLite + sqlite-vec) at repo root.

## Architecture

```
app/src/
├── app/
│   ├── page.tsx                          # Main chat UI (client component)
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Tailwind + CSS variables
│   └── api/
│       ├── chat/route.ts                 # POST: streaming chat with RAG context injection
│       ├── conversations/route.ts        # GET: list all conversations
│       └── conversations/[id]/
│           ├── route.ts                  # GET: conversation + messages, DELETE: remove
│           └── branch/route.ts           # POST: create branch at message index
├── components/
│   ├── ChatInput.tsx                     # Input + model selector
│   ├── MessageList.tsx                   # Message bubbles with branch button
│   └── Sidebar.tsx                       # Tree-structured conversation list
├── lib/
│   ├── db.ts                             # SQLite schema, CRUD, branching, vector ops
│   ├── tokens.ts                         # Token estimation + message windowing
│   ├── embeddings.ts                     # OpenAI embeddings, chunking, embed-on-overflow
│   └── rag.ts                            # RAG orchestrator: budget split, retrieval, lineage
└── types/
    └── index.ts                          # Shared types (Conversation, Message, etc.)
```

### Context budget split

```
total context window
├── RAG chunks           (~20% of available)
├── recent messages      (fills remaining budget)
└── response buffer      (4096 tokens reserved)
```

### API routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/chat` | Send message, stream response (creates conversation on first message) |
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/:id` | Get conversation + messages |
| `DELETE` | `/api/conversations/:id` | Delete conversation + messages + vector chunks |
| `POST` | `/api/conversations/:id/branch` | Branch from message index, returns new conversation |

## Tech

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- SQLite via better-sqlite3 + sqlite-vec for vector search (`opengrove.db`)
- Google Gemini API (`@google/genai`) with Google Search tool
- OpenAI API (`openai`) for chat models + `text-embedding-3-small` embeddings
