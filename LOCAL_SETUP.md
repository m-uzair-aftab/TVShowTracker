# Local Development Setup Guide

This guide will help you set up a local development environment for TVShowTracker using a local/test database from Neon.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)
- A Neon account (free tier works perfectly)
- A local/test database branch in Neon (separate from production)

## Step-by-Step Setup

### 1. Install Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

This will install all required dependencies for both the frontend and backend.

### 2. Create Environment Variables File

Create a `.env` file in the root directory of the project (same level as `package.json`).

**Note:** The `.env` file is already in `.gitignore`, so it won't be committed to version control.

### 3. Set Up Your Local Database in Neon

Before configuring environment variables, you need a local/test database:

1. **Go to Neon Console:** https://console.neon.tech
2. **Create a new project** (or use an existing one)
3. **Create a branch** for local development (or use the main branch if it's a separate project)
4. **Get the connection string:**
   - In your Neon project, go to "Connection Details"
   - Copy the connection string for your local branch
   - It will look like: `postgresql://user:password@ep-xxxxx.region.aws.neon.tech/dbname?sslmode=require`

**Note:** If you want to start with a copy of production data, you can create a branch from your production database in Neon.

### 4. Configure Environment Variables

Add the following environment variables to your `.env` file:

```env
# Database Configuration (Local/Test Database from Neon)
DATABASE_URL=your_local_neon_database_connection_string_here

# Session & Security
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Environment
NODE_ENV=development

# Frontend API URL (optional - defaults to http://localhost:5000)
VITE_API_BASE_URL=http://localhost:5000
```

**Important Notes:**
- **DATABASE_URL**: Use your local/test Neon Postgres connection string (not production!)
- **SESSION_SECRET**: Use a strong random string (different from production for security)
- **JWT_SECRET**: Use a strong random string (can be the same as SESSION_SECRET if you want)
- **NODE_ENV**: Set to `development` for local development
- **VITE_API_BASE_URL**: Only needed if you want to override the default `http://localhost:5000`

### 5. Run Database Migrations

Set up your database schema by running:

```bash
npm run db:push
```

This will:
- Create all necessary tables (users, tv_shows, user_watchlists, season_progress)
- Set up indexes and constraints
- Sync your database schema with your code

**Note:** If you're using a fresh database, this will create all tables. If you branched from production, it will ensure your schema is up to date.

### 6. Start the Development Server

Run the development server:

```bash
npm run dev
```

This command will:
- Start the Express backend server on port 5000
- Start the Vite development server for the React frontend
- Enable hot module replacement (HMR) for fast development
- Serve both the API and the frontend from the same port (5000)

### 7. Access the Application

Once the server is running, open your browser and navigate to:

```
http://localhost:5000
```

The application should now be running locally and connected to your local/test database.

## Available Scripts

- `npm run dev` - Start development server (backend + frontend)
- `npm run build` - Build for production
- `npm run start` - Start production server (requires build first)
- `npm run db:push` - Push database schema changes
- `npm run check` - Type check TypeScript code

## Troubleshooting

### Port Already in Use

If port 5000 is already in use, you can set a different port:

```env
PORT=5001
```

And update `VITE_API_BASE_URL` accordingly:

```env
VITE_API_BASE_URL=http://localhost:5001
```

### Database Connection Issues

- Verify your `DATABASE_URL` is correct and points to your local/test database (not production)
- Ensure your Neon database allows connections from your IP address
- Check that the database credentials are valid
- Make sure you're using the connection string for the correct branch/project

### CORS Issues

If you encounter CORS errors, check that `http://localhost:5000` (or your custom port) is in the `allowedOrigins` array in `server/index.ts`.

### Missing Environment Variables

If you see errors about missing environment variables, ensure your `.env` file is in the root directory and contains all required variables.

## Development Notes

- The development server uses Vite's middleware mode, which provides hot module replacement
- Both frontend and backend are served from the same port (5000) in development
- Session storage uses PostgreSQL via `connect-pg-simple`
- The app supports both JWT tokens and session cookies for authentication

## Benefits of Using a Local/Test Database

✅ **Safe testing** - No risk of affecting production data  
✅ **Fresh start** - Clean database for each feature you're testing  
✅ **Easy reset** - Can drop and recreate tables without worry  
✅ **Experimentation** - Try schema changes without fear  
✅ **Multiple developers** - Each can have their own database branch

## Quick Start (After Initial Setup)

Once everything is set up, to run locally you just need:

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   ```
   http://localhost:5000
   ```

That's it! Your local environment is ready for development.
