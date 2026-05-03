TVShowTracker — Production DB Schema Push
=========================================

Goal
----
Run your Drizzle `db:push` command so it applies the latest schema from your code
to your PRODUCTION database.

When to do this
---------------
- After you change your database schema (tables/columns/indexes) in code.
- Ideally right after you deploy, or right before, as long as the schema code you are
  running locally matches what you are deploying.

Current share-feature schema changes
------------------------------------
The public shared-list feature requires these production DB changes:

- Add `users.username`
- Add unique index `users_username_unique`
- Add `user_share_settings`
- Add unique index `user_share_settings_user_id_unique`

Important safety notes
----------------------
- This will modify your PRODUCTION database schema.
- Double-check you are using the PRODUCTION `DATABASE_URL`, not local/dev.
- Preferably create a DB backup or snapshot first if your DB provider supports it.
- Do not use `--force` for production schema pushes.
- If Drizzle asks whether to truncate the `users` table, choose:

  ```txt
  No, add the constraint without truncating the table
  ```

Prereqs
-------
- You have the production database connection string (`DATABASE_URL`), e.g. from Neon.
- You can run node/npm in this repo (`npm install` has already worked for you).

macOS / Linux / zsh / bash
--------------------------
1) Open Terminal.

2) `cd` into your project folder:

```bash
cd "<project-root>"
```

3) Set `DATABASE_URL` for this terminal session only:

```bash
export DATABASE_URL='YOUR_PROD_DATABASE_URL'
```

Example Neon-style URL:

```bash
export DATABASE_URL='postgresql://user:password@host/neondb?sslmode=require&channel_binding=require'
```

Notes:
- Use single quotes around the URL in zsh/bash.
- This does not modify your `.env` file.
- This value disappears when you close the terminal, or when you unset it.

4) Verify the value:

```bash
echo "$DATABASE_URL"
```

Confirm it prints your production URL.

5) Install dependencies if needed:

```bash
npm install
```

You can skip this if you already have a working `node_modules` and you have not changed dependencies.

6) Run the schema push:

```bash
npm run db:push
```

7) Confirm success:
- The command should exit without errors.
- Optionally check your DB tables/columns in Neon’s dashboard.
- Optionally run your backend and hit an endpoint that relies on the new schema.

Cleanup:

```bash
unset DATABASE_URL
```

Mac one-liner version
---------------------
If dependencies are already installed and you want to set the URL for just one command:

```bash
DATABASE_URL='YOUR_PROD_DATABASE_URL' npm run db:push
```

Windows CMD
-----------
1) Open Command Prompt (`cmd.exe`).

2) `cd` into your project folder.

Example:

```cmd
cd <project-root>
```

If your backend is in a subfolder or monorepo, `cd` into that backend folder instead.

3) Set `DATABASE_URL` for this CMD window only:

```cmd
set "DATABASE_URL=YOUR_PROD_DATABASE_URL"
```

Example Neon-style URL:

```cmd
set "DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require&channel_binding=require"
```

Notes:
- Do not wrap the URL in single quotes in CMD.
- This does not modify your `.env` file.
- This value disappears when you close the CMD window.

4) Verify the value:

```cmd
echo %DATABASE_URL%
```

Confirm it prints your production URL.

5) Install dependencies if needed:

```cmd
npm install
```

You can skip this if you already have a working `node_modules` and you have not changed dependencies.

6) Run the schema push:

```cmd
npm run db:push
```

7) Confirm success:
- The command should exit without errors.
- Optionally check your DB tables/columns in Neon’s dashboard.
- Optionally run your backend and hit an endpoint that relies on the new schema.

Cleanup:

```cmd
set "DATABASE_URL="
```

Or just close the CMD window.

Windows one-liner version
-------------------------
If you want to do it in one command:

```cmd
set "DATABASE_URL=YOUR_PROD_DATABASE_URL" && npm install && npm run db:push
```

Troubleshooting
---------------
- If `db:push` connects to the wrong DB:
  - Re-check `echo "$DATABASE_URL"` on Mac/Linux or `echo %DATABASE_URL%` on Windows.
  - Ensure `drizzle.config.ts` uses `DATABASE_URL`.

- If Drizzle prompts about truncating `users`:
  - Choose `No, add the constraint without truncating the table`.
  - Do not rerun with `--force`.

- If `npm install` / `db:push` fails with `EPERM` or locked files:
  - Close editors/dev servers/watchers using the project.
  - local folder folders sometimes cause file-lock issues; consider moving the repo to
    a non-synced folder like `C:\dev\TVShowTracker`.
