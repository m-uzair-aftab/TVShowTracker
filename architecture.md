# TV Show & Movies Tracker – Architecture Overview

## 1. High-Level Architecture

The TV Show & Movies Tracker is a full-stack web application with:

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** Neon Postgres (via Drizzle ORM)
- **Hosting:**
  - **Backend:** Render
  - **Frontend:** Netlify
- **Auth:** Cookie-based session management (Express session stored in Postgres)

---

## 2. Components

### 2.1 Frontend (Netlify)
- Located in `/client`
- Bundled with **Vite** for fast builds
- Uses:
  - `@tanstack/react-query` for data fetching + caching (with a **default queryFn**)
  - (Your router) for navigation
  - `use-auth` custom hook for auth state
  - `API_BASE_URL` env var injected at build time
- Communicates with backend via `fetch` calls to `${API_BASE_URL}/api/...`

#### 2.1.1 Frontend State Management
- **React Query** for server state:
  - Central **default queryFn** prefixes `${API_BASE_URL}`, adds `credentials`, parses JSON
  - Consistent `queryKey` convention: `['/api/path', { params… }]`
  - Optimistic updates (e.g., for watchlist) where applicable
- Custom hooks:
  - `useAuth` – authentication state and operations (login, logout, register)
  - (Remove this bullet if not present) `useMobile` – responsive helpers
  - (Remove this bullet if not present) `useNavigationContext` – navigation state

#### 2.1.2 API Utilities
- Centralized helpers in **`client/src/lib/queryClient.ts`**:
  - `apiRequest(method, path, data?)`
  - `getQueryFn()` returned to React Query defaults

### 2.2 Backend (Render)
- Located in `/server`
- **Express** server; routes under `/api/...`
- **Sessions**: `express-session` with **Postgres store** via `connect-pg-simple`
  - Cookie options in production: `httpOnly: true`, `sameSite: 'none'`, `secure: true`
  - `app.set('trust proxy', 1)` for Render
- **CORS** configured to allow:
  - Local dev (`http://localhost:5173`)
  - Production Netlify site (exact origin)
  - `credentials: true`
- (Optional) Can serve `dist/public` if present, but in production the SPA is hosted on **Netlify**

### 2.3 Database (Neon Postgres)
- Managed Postgres instance (Neon)
- Accessed via `drizzle-orm` (Neon serverless driver)
- Tables include:
  - `users` – auth credentials and profile info
  - `tv_shows` – TV show metadata
  - `user_watchlists` – user–show relationships
  - `season_progress` – per-season tracking
  - `movies` – movie metadata
  - `user_movie_lists` – user–movie relationships
  - `movie_activity` – movie tracking (date, rating, watched using)
  - `session` – express-session store
- Migrations run via Drizzle

---

## 3. Authentication Flow (Current Implementation)

- User logs in via `/api/auth/login`
- Backend verifies credentials, creates a session, and sets an **HTTP-only secure cookie**
- Browser automatically sends the cookie with subsequent API calls
- Logout clears the session on the server and removes the cookie
- No tokens are stored in `localStorage` or `sessionStorage`

> Note: Because frontend and backend are on different domains (Netlify ⇆ Render), production cookies use `sameSite: 'none'` and `secure: true`. iOS Safari requires this.

---

## 4. Data Flow

### 4.1 Fetch TV Watchlist
1. Frontend calls `/api/watchlist` with credentials (`credentials: 'include'`)
2. Backend validates session via cookie
3. Queries `user_watchlists` joined with `tv_shows`
4. Returns list of shows in JSON
5. Frontend renders via React Query

### 4.2 Add to TV Watchlist
1. Frontend `POST /api/watchlist` with show ID
2. Backend adds entry for current user
3. Returns updated list or success status

### 4.3 Search Movies
1. Frontend calls `/api/movies/search?query=...`
2. Backend queries TMDB, upserts into `movies`
3. Returns movie list to the UI

### 4.4 Save Movie Activity
1. Frontend `POST /api/movies/list/:movieId/activity`
2. Backend stores date/rating/watchedUsing in `movie_activity`
3. UI updates and list views reflect the new fields

---

## 5. Environment Variables

### Backend (Render)
- `DATABASE_URL` – Neon Postgres connection string
- `SESSION_SECRET` – secret for `express-session`
- `NODE_ENV` – `production` on Render (enables secure cookies)
- `TMDB_API_KEY` – TMDB API key for movie search and details

### Frontend (Netlify)
- `VITE_API_BASE_URL` – base URL for API requests

---

## 6. Directory Structure
```txt
root/
  client/                 # React frontend
    src/
      hooks/              # Custom React hooks (e.g., use-auth.tsx)
      components/         # UI components
      lib/                # queryClient.ts (apiRequest, default queryFn)
      config.ts           # API_BASE_URL setup
      main.tsx            # App entry
  server/                 # Express backend
    index.ts              # Main server entry point
    routes/               # API route handlers
    db/                   # Drizzle schema + queries
  shared/                 # (If used) shared types/utilities
  dist/public/            # Frontend build output (optional on server)
```

## 7. Flow Diagrams
### 7.1 Login Flow
```
[User] -> [Frontend: Login Form]
    POST /api/auth/login  (credentials: 'include')
    -> [Backend] Verify in DB
    -> Set HTTP-only cookie
    -> Return user JSON
    -> [Frontend] Cache user via use-auth/react-query
```

### 7.2 Fetch Watchlist
```
[User visits Watchlist page]
    -> [Frontend] useQuery(['/api/watchlist'])
    -> [Default queryFn] fetch(API_BASE_URL + '/api/watchlist', { credentials: 'include' })
    -> [Backend] Check session cookie
    -> Query DB
    -> Return watchlist JSON
    -> [Frontend] render list
```

### 7.3 Logout
```
[User clicks Logout]
    -> [Frontend] POST /api/auth/logout
    -> [Backend] destroy session + clear cookie
    -> [Frontend] clear cached '/api/auth/me' + redirect to login
```

## 8. Key Points

- All API calls from the frontend must set credentials: 'include'
- API base URL is determined by VITE_API_BASE_URL at build time
- CORS on backend must list exact origins (local + Netlify) and credentials: true
- Apply DB migrations to Neon before deploying backend changes
- Session cookies: httpOnly, secure in prod, sameSite: 'none' for cross-site
