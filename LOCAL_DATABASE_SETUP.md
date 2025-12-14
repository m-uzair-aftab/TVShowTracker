# Setting Up a Local/Test Database

This guide will help you set up a separate database for local development and testing, keeping your production data safe.

## Option 1: Neon Free Tier (Recommended - Easiest)

Neon offers a free tier that's perfect for local development. It's the same database service you're already using, so setup is seamless.

### Steps:

1. **Create a new Neon account/project:**
   - Go to https://console.neon.tech
   - Sign up or log in
   - Click "Create a project"
   - Give it a name like "tvshowtracker-local" or "tvshowtracker-dev"

2. **Get the connection string:**
   - In your Neon project dashboard
   - Go to "Connection Details" or "Connection String"
   - Copy the connection string (it will look like: `postgresql://user:password@ep-xxxxx.region.aws.neon.tech/dbname?sslmode=require`)

3. **Update your `.env` file:**
   - Replace `DATABASE_URL` with your new Neon connection string
   - Keep `NODE_ENV=development`

4. **Run migrations:**
   ```bash
   npm run db:push
   ```
   This will create all the tables in your new empty database.

5. **Optional - Seed test data:**
   - You can manually create test users through the app
   - Or create a simple seed script if needed

## Option 2: Local PostgreSQL (More Setup Required)

If you prefer running PostgreSQL locally on your machine:

### Prerequisites:
- Install PostgreSQL on Windows
- Download from: https://www.postgresql.org/download/windows/

### Steps:

1. **Install PostgreSQL:**
   - Run the installer
   - Remember the password you set for the `postgres` user
   - Note the port (default is 5432)

2. **Create a database:**
   - Open pgAdmin (comes with PostgreSQL) or use command line:
   ```sql
   CREATE DATABASE tvshowtracker_dev;
   ```

3. **Update your `.env` file:**
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/tvshowtracker_dev
   ```

4. **Run migrations:**
   ```bash
   npm run db:push
   ```

## Option 3: Docker PostgreSQL (Good for Isolation)

If you have Docker installed:

### Steps:

1. **Run PostgreSQL in Docker:**
   ```bash
   docker run --name tvshowtracker-db -e POSTGRES_PASSWORD=dev-password -e POSTGRES_DB=tvshowtracker_dev -p 5432:5432 -d postgres
   ```

2. **Update your `.env` file:**
   ```env
   DATABASE_URL=postgresql://postgres:dev-password@localhost:5432/tvshowtracker_dev
   ```

3. **Run migrations:**
   ```bash
   npm run db:push
   ```

## Quick Setup (Recommended: Neon Free Tier)

The fastest way to get started:

1. **Create Neon account:** https://console.neon.tech
2. **Create new project** (separate from production)
3. **Copy connection string**
4. **Update `.env` file** with new connection string
5. **Run:** `npm run db:push`

That's it! You'll have a fresh, empty database for local development.

## After Setting Up Your New Database

Once you've updated your `.env` file with the new `DATABASE_URL`:

1. **Verify the connection:**
   ```bash
   npm run db:push
   ```
   This should successfully create all tables without any prompts about existing data.

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **Create a test account:**
   - Use the app's registration/signup feature
   - This will create your first user in the new database

## Benefits of Using a Separate Database

✅ **Safe testing** - No risk of affecting production data  
✅ **Fresh start** - Clean database for each feature you're testing  
✅ **Easy reset** - Can drop and recreate tables without worry  
✅ **Multiple developers** - Each can have their own database  
✅ **Experimentation** - Try schema changes without fear

## Switching Back to Production (If Needed)

If you ever need to switch back to production database:
- Just update `DATABASE_URL` in `.env` to the production connection string
- Make sure `NODE_ENV=production` (or keep it as development if you're just testing)
