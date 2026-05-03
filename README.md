# TVShowTracker

TVShowTracker is a full-stack web app for keeping track of TV shows and movies. It lets users search for titles, save them to personal lists, record progress and ratings, and share a read-only public version of their list.

The app includes:

- TV show tracking with season progress, watched seasons, ratings, and year filters.
- Movie tracking with ratings, watched dates, sorting, filtering, and CSV export.
- Account-based personal lists.
- Public shared-list pages that can be viewed without signing in.

You can use TVShowTracker here: https://tvshowtracker.netlify.app/

You can see Uzair Aftab's shared list here: https://tvshowtracker.netlify.app/uzairaftab/shared-list

## Why I Built This

I have always been an avid TV and movie watcher. For years, I tracked what I watched in an Excel sheet, with my own very specific scoring and grading system. I would often share that list with my brother and a few close friends.

When the vibe coding movement started, it felt like the perfect opportunity to build something designed around exactly how I track shows and movies. Other people can use TVShowTracker too, but the app is intentionally shaped around my own habits, so some features, like the grading scheme or scoring system, may feel a little unusual. For my use case, though, it works really well.

I originally built the app in Replit, then later decided to take more control of the codebase and deploy it myself. Along the way, it became a way to explore coding tools like Codex, Cursor, and Claude, and to learn more by working directly with the code.

I wrote more about that process here: [My vibe coding journey from Replit](https://muzairaftab.substack.com/p/my-vibe-coding-journey-from-replit?r=5b1v1&utm_campaign=post&utm_medium=web&triedRedirect=true).

## Tech Stack

- React, Vite, and TypeScript
- Express and Node.js
- Drizzle ORM and Neon Postgres
- Tailwind CSS and shadcn/ui-style components
- TVmaze and TMDB data APIs
