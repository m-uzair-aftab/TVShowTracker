# Product Overview

TVShowTracker helps users keep a personal record of TV shows and movies, including watch progress, ratings, filters, and public sharing.

## Core Features

- Email/password accounts.
- TV show search and detail pages powered by TVmaze.
- Movie search and detail pages powered by TMDB.
- Personal TV list with season progress, watched seasons, average rating, grade, and year filtering.
- AI Insights tab for a stored TV Taste Profile generated from watched seasons, ratings, genres, and activity.
- AI Insights tab for a stored Movie Taste Profile generated from watched movies, ratings, genres, and activity.
- AI generation failures show friendly retry copy in the UI while detailed provider diagnostics remain in backend logs.
- Operator-only LLM Observability dashboard with raw prompts, outputs, model metadata, token usage, latency, errors, and summary metrics.
- Personal movie list with watched date, rating, watched platform, sorting, year filtering, and CSV export.
- Settings page for enabling a public shared list.
- Read-only public shared-list pages at `/:username/shared-list`.

## Public Shared Lists

Users can choose a public username, enable sharing, and decide whether to share all years or selected years.

Public viewers do not need an account. The shared page shows TV Shows and Movies tabs while hiding private edit controls and management actions.

## Tech Stack

- React, Vite, TypeScript
- Wouter routing
- TanStack Query
- Tailwind CSS and shadcn/ui-style components
- Express
- Drizzle ORM
- Postgres
- JWT plus Express session authentication

## Important Routes

Client routes:

- `/auth`
- `/`
- `/search`
- `/ai-insights`
- `/movies`
- `/movies/search`
- `/movies/ai-insights`
- `/settings`
- `/observability/llm`
- `/:username/shared-list`

API routes:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/watchlist/myshows`
- `GET /api/ai-insights/tv/taste-profile`
- `POST /api/ai-insights/tv/taste-profile/regenerate`
- `GET /api/ai-insights/movie/taste-profile`
- `POST /api/ai-insights/movie/taste-profile/regenerate`
- `GET /api/observability/llm-calls`
- `GET /api/observability/llm-summary`
- `GET /api/movies/list/mylist`
- `GET /api/share-settings`
- `PATCH /api/share-settings`
- `GET /api/shared-list/:username`

## Local Development

See `LOCAL_SETUP.md` and `LOCAL_DATABASE_SETUP.md`.

Before deploying schema changes, see `PRODUCTION_DB_PUSH.md`.
