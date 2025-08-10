# TVShowTracker

A full-stack web application for tracking TV shows with hybrid authentication support.

## Environment Variables

### Backend (Server)
- `DATABASE_URL` - Neon Postgres connection string
- `SESSION_SECRET` - Secret for express-session
- `JWT_SECRET` - Secret for JWT tokens (can use SESSION_SECRET as fallback)
- `NODE_ENV` - Environment (production/development)

### Frontend (Client)
- `VITE_API_BASE_URL` - Base URL for API requests

## Authentication

This app supports **hybrid authentication**:
- **JWT Tokens** (primary) - Stored in localStorage, sent via Authorization header
- **Session Cookies** (fallback) - Traditional express-session for backward compatibility

This approach ensures compatibility with iOS Safari while maintaining existing functionality.

## Setup

1. Install dependencies: `npm install`
2. Set environment variables
3. Run database migrations: `npm run db:push`
4. Start development server: `npm run dev`

