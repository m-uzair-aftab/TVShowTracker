# Local Database Setup

Use a separate development database so local testing never affects production data.

## Option 1: Neon Development Database

1. Create a new Neon project or branch for development.
2. Copy the development connection string from the Neon dashboard.
3. Add it to your local `.env` file as `DATABASE_URL`.
4. Run:

```bash
npm run db:push
```

## Option 2: Local Postgres

1. Install PostgreSQL locally.
2. Create a development database.
3. Set `DATABASE_URL` in `.env` to your local database connection string.
4. Run:

```bash
npm run db:push
```

## Option 3: Docker Postgres

If Docker is available, run a local Postgres container with development-only credentials, then set `DATABASE_URL` in `.env` to that container's connection string.

After the database is ready, start the app with:

```bash
npm run dev
```

Create a test account through the app's sign-up flow.

## Safety Notes

- Keep development and production database URLs separate.
- Do not commit `.env` files or real connection strings.
- Use provider snapshots or branches before testing destructive schema changes against important data.
