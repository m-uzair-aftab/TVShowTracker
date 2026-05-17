# Production Database Schema Push

Use this checklist when applying Drizzle schema changes to a production database.

## When To Run

Run a production schema push after code changes modify tables, columns, indexes, or constraints.

## Safety Checklist

- Confirm the deployed code expects the same schema you are about to push.
- Confirm `DATABASE_URL` points to production only for the command that needs it.
- Prefer a database backup or provider snapshot first.
- Do not commit production database URLs or credentials.
- Do not use destructive flags unless you have reviewed the generated changes.

## Run The Push

Install dependencies if needed:

```bash
npm install
```

Run the push with the production database URL for this command only:

```bash
DATABASE_URL='your_production_postgres_url' npm run db:push
```

Or export `DATABASE_URL` in the current shell session first:

```bash
export DATABASE_URL='your_production_postgres_url'
npm run db:push
```

Confirm that the command exits successfully, then verify the expected tables, columns, and indexes in your database provider dashboard.

## Cleanup

If you exported a production `DATABASE_URL` locally for a single terminal session, unset it when finished:

```bash
unset DATABASE_URL
```

On Windows Command Prompt:

```cmd
set "DATABASE_URL="
```
