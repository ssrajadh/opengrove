# OpenGrove

Local-first AI chat app. React + TypeScript + Tailwind, runs on localhost.

## Setup

better-sqlite3 is a native addon and needs build tools (`build-essential`, `python3`) on Linux. On Ubuntu: `sudo apt install build-essential`.

```bash
cd app && npm install
cp .env.example .env
# Or copy from repo root: cp ../.env.example .env
# Edit .env: GEMINI_API_KEY (https://aistudio.google.com/apikey), OPENAI_API_KEY (https://platform.openai.com/api-keys) for OpenAI search models
```

**Run from repo root:**

```bash
npm run dev
```

**Or from frontend:**

```bash
cd app && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **`.env`** can live at repo root or in `frontend/`; the app loads `../.env` when running from `frontend/`.
- **Data** is stored in `opengrove.db` (SQLite) at the repo root.

## Features

- **Chat UI**: User messages on the right, AI on the left; input + send; model selector (Gemini 2.0/3.x and OpenAI search models).
- **Web search**: Gemini uses Google Search grounding; OpenAI uses Responses API with `web_search_preview` tool (any model: GPT-4o, GPT-4o Mini, GPT-4.1, etc.).
- **Sidebar**: Conversation history; "New chat" starts a new thread.
- **Storage**: Conversations and messages in `opengrove.db` (SQLite) at repo root.
- **API**: `POST /api/chat` calls Gemini (with optional search) and saves each turn.

## Tech

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- SQLite via better-sqlite3 (`opengrove.db`)
- Google Gemini API (`@google/genai`) with Google Search tool; OpenAI API (`openai`) with web search models
