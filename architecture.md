# Architecture Overview

TVShowTracker is a full-stack application for tracking TV shows and movies.

## High-Level Stack

- Frontend: React, TypeScript, Vite, TanStack Query, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: Postgres through Drizzle ORM
- Hosting: Netlify for the frontend and a Node-capable backend host
- External data: TVmaze for TV shows and TMDB for movies
- AI generation: NVIDIA-hosted OpenAI-compatible LLM endpoint for stored insights
- LLM observability: durable Postgres logs plus an operator-only React dashboard

## Frontend

The frontend lives in `client/`.

Key responsibilities:

- Route users through account, TV, movie, settings, and public shared-list pages.
- Fetch API data through shared query helpers.
- Store authenticated user state with TanStack Query.
- Render personal list views and read-only public shared-list views.

## Backend

The backend lives in `server/`.

Key responsibilities:

- Expose API routes under `/api`.
- Authenticate users with JWT bearer tokens and session fallback support.
- Store user lists, ratings, progress, and sharing settings.
- Fetch and normalize TVmaze and TMDB search/detail data.
- Generate and persist TV and movie AI insights from authenticated user history.
- Route every LLM provider call through the shared `server/llm-client.ts` observability layer.
- Sanitize AI provider failures before returning them to clients while storing structured diagnostics for the failed stage, provider, model, upstream status, upstream response body, request payload, output, token usage, and response time.

## Database

The schema is defined in `shared/schema.ts` and managed with Drizzle.

Important data areas include:

- Users and authentication
- TV show metadata
- User TV watchlists and season progress
- Movie metadata
- User movie lists and movie activity
- Public share settings
- Stored AI insights for TV and movies, including media type, insight type, profile JSON, source summary, model, and generation timestamps
- LLM call logs, including raw request payloads, outputs, provider responses, provider/model metadata, token usage, latency, errors, and associated user identity
- Session storage

## LLM Observability

All current and future LLM calls must go through `server/llm-client.ts`. Feature code should not call provider endpoints directly or read provider credentials directly. The `npm run check:llm-guardrail` script fails if app source references known LLM provider endpoints or credentials outside the shared client.

The dashboard is available at `/observability/llm` for authenticated users whose email appears in `OBSERVABILITY_ADMIN_EMAILS`. Backend observability APIs repeat this admin check before returning raw logs or summaries.

Raw LLM logs are stored in Postgres and retained for 90 days. Logs intentionally include full prompts and outputs for debugging, so access is operator-only.

## Public Shared Lists

Users can enable sharing from Settings. Public list URLs use this shape:

```txt
/:username/shared-list
```

Public shared-list pages are read-only and hide private edit controls.

## Environment Variables

Required production values should be configured through the deployment provider:

- `DATABASE_URL`
- `SESSION_SECRET`
- `JWT_SECRET`
- `TMDB_API_KEY`
- `NVIDIA_BASE_URL`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `OBSERVABILITY_ADMIN_EMAILS`
- `NODE_ENV`
- `VITE_API_BASE_URL`

Local values belong in `.env`, which is ignored by Git.
