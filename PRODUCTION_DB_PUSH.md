TVShowTracker — Production DB Schema Push (Windows CMD)
=====================================================

Goal
----
Run your Drizzle “db:push” command from your Windows Command Prompt (cmd.exe)
so it applies the latest schema from your code to your PRODUCTION database.

When to do this
---------------
- After you change your database schema (tables/columns/indexes) in code.
- Ideally right after you deploy (or right before, as long as the schema code you’re running
  locally matches what you’re deploying).

Important safety notes
----------------------
- This will modify your PRODUCTION database schema.
- Double-check you are using the PRODUCTION DATABASE_URL (not local/dev).
- Preferably create a DB backup or snapshot first (if your DB provider supports it).

Prereqs
-------
- You have the production database connection string (DATABASE_URL), e.g. from Neon.
- You can run node/npm in this repo (npm install has already worked for you).

Step-by-step (CMD)
------------------
1) Open Command Prompt (cmd.exe)

2) cd into your project folder
   Example:
   cd <project-root>

   If your backend is in a subfolder (monorepo), cd into that backend folder instead.

3) Set DATABASE_URL for THIS CMD WINDOW ONLY
   Use the safe quoting form below (recommended):

   set "DATABASE_URL=YOUR_PROD_DATABASE_URL"

   Example (Neon-style URL):
   set "DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require&channel_binding=require"

   Notes:
   - Do NOT wrap the URL in single quotes in CMD.
   - This does NOT modify your .env file.
   - This value disappears when you close the CMD window.

4) Verify (optional but recommended)

   echo %DATABASE_URL%

   Confirm it prints your production URL.

5) Install dependencies (if needed)

   npm install

   You can skip this if you already have a working node_modules and you haven’t changed deps.

6) Run the schema push

   npm run db:push

7) Confirm success
   - The command should exit without errors.
   - Optionally check your DB tables/columns in Neon’s dashboard.
   - Optionally run your backend and hit an endpoint that relies on the new schema.

Cleanup (optional)
------------------
Unset the env var in the same CMD window:

set "DATABASE_URL="

Or just close the CMD window.

One-liner version (optional)
----------------------------
If you want to do it in one command:

set "DATABASE_URL=YOUR_PROD_DATABASE_URL" && npm install && npm run db:push

Troubleshooting
---------------
- If db:push connects to the wrong DB:
  - Re-check echo %DATABASE_URL%
  - Ensure your drizzle config uses DATABASE_URL

- If npm install / db:push fails with EPERM or locked files:
  - Close editors/dev servers/watchers using the project.
  - local folder folders sometimes cause file-lock issues; consider moving the repo to
    a non-synced folder like C:\dev\TVShowTracker.
