# TherapyNav

AI-guided therapy appointment booking agent. Takes a user from expressing a need for therapy to having an appointment booked (or a ready-to-send outreach message).

## Architecture

```
Frontend (React + Vite + Tailwind)  ←→  Backend (Express + WebSocket)
                                              ↓
                                    Anthropic Claude (Sonnet)
                                    + Playwright browser automation
```

## Features

- **Empathetic intake chat** — conversational multi-turn intake to capture preferences
- **Real-time directory search** — searches Psychology Today and other directories via Playwright
- **AI-powered ranking** — scores therapists by insurance match, specialty, availability
- **Booking automation** — fills non-sensitive form fields automatically
- **Trust boundary enforcement** — hard-coded checks prevent sensitive fields (passwords, DOB, insurance IDs) from being handled by the agent
- **Fallback outreach** — generates an editable email template when booking URLs aren't available

## Quick Start

### Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Clone and enter the project
cd therapy-nav

# Backend
cp .env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY

cd backend
npm install
npx playwright install chromium

# Frontend (separate terminal)
cd ../frontend
npm install
```

### Run in development

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

### Docker

```bash
# Copy and fill in your API key
cp .env.example .env

docker compose up --build
```

## Project Structure

```
therapy-nav/
├── backend/
│   └── src/
│       ├── agent/
│       │   ├── orchestrator.ts      # LLM tool-use agentic loop
│       │   ├── systemPrompt.ts      # Agent system prompt
│       │   └── tools/
│       │       ├── searchTool.ts    # Playwright directory scraping
│       │       ├── extractionTool.ts
│       │       ├── rankingTool.ts   # Pure scoring function
│       │       ├── bookingTool.ts   # Playwright booking automation
│       │       └── outreachTool.ts  # Fallback message generator
│       ├── routes/session.ts        # REST API routes
│       ├── sessionStore.ts          # In-memory session + WebSocket registry
│       ├── trustBoundary.ts         # Hard-coded sensitive field blocklist
│       └── server.ts
└── frontend/
    └── src/
        ├── pages/                   # Landing, IntakeChat, SearchStatus, Results, Booking
        ├── components/              # ChatBubble, TherapistCard, TrustBoundaryBanner, etc.
        ├── store/sessionStore.ts    # Zustand state + API calls
        └── hooks/useAgentSocket.ts  # WebSocket connection hook
```

## Trust Boundary Rules

These are enforced as hard-coded checks, **not** LLM judgments:

1. The LLM context never receives passwords, insurance IDs, SSNs, DOBs, or payment info.
2. Every booking form field label is checked against a blocklist before filling.
3. Sessions are in-memory only, expire after 2 hours, and are never persisted.
4. Playwright runs in an isolated context with no access to the user's browser profile.
5. Outreach messages are always user-editable before sending.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Anthropic API key |
| `PORT` | `3001` | Backend port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `SESSION_TTL_MS` | `7200000` | Session lifetime (2 hours) |
| `MAX_SEARCH_RESULTS` | `20` | Max profiles to extract |
| `MAX_SHORTLIST` | `5` | Max profiles shown to user |
| `PLAYWRIGHT_HEADLESS` | `true` | Run browser headless |
