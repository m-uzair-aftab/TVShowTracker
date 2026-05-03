# Local Development Setup

This guide describes how to run TVShowTracker locally with a development database.

## Prerequisites

- Node.js 18 or newer
- npm
- A development Postgres database, such as a Neon branch or local Postgres instance
- API credentials for any external services you want to use locally

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root.

The `.env` file is ignored by Git. Do not commit real database URLs, API keys, session secrets, JWT secrets, or production credentials.

3. Add local environment variables:

```env
DATABASE_URL=your_development_database_url
SESSION_SECRET=your_local_session_secret
JWT_SECRET=your_local_jwt_secret
TMDB_API_KEY=your_tmdb_api_key
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:5001
```

4. Push the database schema:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

The app defaults to `http://localhost:5001`.

## Useful Scripts

- `npm run dev` - start the local development server
- `npm run check` - run TypeScript checks
- `npm run build` - build the app
- `npm run start` - run the production build
- `npm run db:push` - push the Drizzle schema to the configured database
- `npm run build:client` - build only the Vite client

## Troubleshooting

If the port is already in use, set `PORT` and update `VITE_API_BASE_URL` to match.

If database commands fail, verify that `DATABASE_URL` points to a development database and that the credentials are valid.

If external movie search fails, verify that `TMDB_API_KEY` is configured.
