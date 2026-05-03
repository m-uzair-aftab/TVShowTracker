# Product Overview

TVShowTracker helps users keep a personal record of TV shows and movies, including watch progress, ratings, filters, and public sharing.

## Core Features

- Email/password accounts.
- TV show search and detail pages powered by TVmaze.
- Movie search and detail pages powered by TMDB.
- Personal TV list with season progress, watched seasons, average rating, grade, and year filtering.
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
- `/movies`
- `/movies/search`
- `/settings`
- `/:username/shared-list`

API routes:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/watchlist/myshows`
- `GET /api/movies/list/mylist`
- `GET /api/share-settings`
- `PATCH /api/share-settings`
- `GET /api/shared-list/:username`

## Local Development

See `LOCAL_SETUP.md` and `LOCAL_DATABASE_SETUP.md`.

Before deploying schema changes, see `PRODUCTION_DB_PUSH.md`.
