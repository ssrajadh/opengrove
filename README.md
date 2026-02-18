# OpenGrove

Local-first AI chat app. React + TypeScript + SQLite + Tailwind, runs on localhost.

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY from https://aistudio.google.com/apikey
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Chat UI**: User messages on the right, AI on the left; input + send; model selector (Gemini 1.5 Flash/Pro, 2.0 Flash).
- **Sidebar**: Conversation history; "New chat" starts a new thread.
- **Storage**: Conversations and messages stored in `opengrove.json` (simple JSON file, no DB server).
- **API**: `POST /api/chat` calls Gemini and saves each turn to the DB.

## Tech

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- JSON file for persistence (opengrove.json)
- Google Gemini API via `@google/genai`
