# Architecture Overview

TVShowTracker is a full-stack application for tracking TV shows and movies.

## High-Level Stack

- Frontend: React, TypeScript, Vite, TanStack Query, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: Postgres through Drizzle ORM
- Hosting: Netlify for the frontend and a Node-capable backend host
- External data: TVmaze for TV shows and TMDB for movies

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

## Database

The schema is defined in `shared/schema.ts` and managed with Drizzle.

Important data areas include:

- Users and authentication
- TV show metadata
- User TV watchlists and season progress
- Movie metadata
- User movie lists and movie activity
- Public share settings
- Session storage

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
- `NODE_ENV`
- `VITE_API_BASE_URL`

Local values belong in `.env`, which is ignored by Git.
