# TVShowTracker

TVShowTracker is a full-stack web app for tracking TV shows and movies, recording viewing progress and ratings, and sharing a read-only public version of a user's list.

## Features

- Email/password authentication with JWT and session-cookie support.
- TV show search and detail views backed by TVmaze data.
- Movie search and detail views backed by TMDB data.
- Personal TV show watchlist with season progress, watched seasons, average rating, grade, and year filtering.
- Personal movie list with watched date, rating, watched platform, sorting, year filtering, and CSV export in table view.
- Settings page for managing public sharing.
- Public shared-list pages at `/:username/shared-list` for external viewers without an account.

## Public Shared Lists

Users can open Settings, choose a unique public handle, enable sharing, and choose whether to share all years or selected activity years.

Shared-list behavior:

- Public URL format: `/:username/shared-list`.
- No account is required to view a shared list.
- Shared views are read-only and use dedicated public API routes.
- The public page shows TV Shows and Movies tabs in large-card view.
- Public TV cards show watched seasons, average rating, and grade.
- Public movie cards show rating.
- Dates, watched platform, edit controls, add/remove controls, export controls, and "Your" wording are hidden.
- If the owner shares all years, public viewers can filter the shared list by activity year.
- Logged-out viewers see a `Sign In / Sign Up` link in the header.
- Logged-in viewers see the avatar menu with `Your TV & Movies`, `Settings`, and `Sign out`.

## Tech Stack

- React, Vite, TypeScript
- Wouter routing
- TanStack Query
- Tailwind CSS and shadcn/ui-style components
- Express
- Drizzle ORM
- Neon Postgres
- JWT plus Express session authentication

## Important Routes

### Client

- `/auth` - login and registration
- `/` - TV shows home and list
- `/search` - TV show search tab
- `/movies` - movies home and list
- `/movies/search` - movie search tab
- `/settings` - share settings
- `/:username/shared-list` - public shared list

### API

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/watchlist/myshows`
- `GET /api/movies/list/mylist`
- `GET /api/share-settings`
- `PATCH /api/share-settings`
- `GET /api/shared-list/:username`

## Environment Variables

### Backend

- `DATABASE_URL` - Neon Postgres connection string
- `SESSION_SECRET` - secret for Express sessions
- `JWT_SECRET` - secret for JWT tokens; falls back to `SESSION_SECRET`
- `NODE_ENV` - `development` or `production`
- `PORT` - server port; defaults to `5001`

### Frontend

- `VITE_API_BASE_URL` - base URL for API requests

## Authentication

The app uses hybrid authentication:

- JWT tokens are stored in localStorage and sent with the `Authorization` header.
- Session cookies remain available as a fallback for compatibility.

Login continues to use email and password. Public usernames are only used for share URLs.

## Database

The schema is defined in `shared/schema.ts` and managed with Drizzle.

Important tables include:

- `users`
- `tv_shows`
- `movies`
- `user_watchlists`
- `season_progress`
- `user_movie_lists`
- `movie_activity`
- `user_share_settings`
- `session`

After schema changes, run:

```bash
npm run db:push
```

For production database updates, see `PRODUCTION_DB_PUSH.md`.

For local/test database setup, see `LOCAL_DATABASE_SETUP.md`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`, especially `DATABASE_URL`, `SESSION_SECRET`, and `JWT_SECRET`.

3. Push the database schema:

```bash
npm run db:push
```

4. Start the development server:

```bash
npm run dev
```

By default, the app runs on `http://localhost:5001`.

If that port is already in use:

```bash
PORT=5002 npm run dev
```

## Scripts

- `npm run dev` - start the local development server
- `npm run check` - run TypeScript checks
- `npm run build` - build client and server
- `npm run start` - run the production build
- `npm run db:push` - push Drizzle schema changes to the configured database
- `npm run build:client` - build only the Vite client

## Verification

Before deploying or handing off changes, run:

```bash
npm run check
npm run build
```

For share-related changes, also verify:

- Login still works.
- `/settings` loads for a logged-in user.
- Saving share settings disables the Save button until another change is made.
- A public `/:username/shared-list` URL works while sharing is enabled.
- Disabled sharing makes the public URL unavailable.
- Public shared-list pages are read-only and hide private tracking details.
