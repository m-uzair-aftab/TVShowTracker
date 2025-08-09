// --- imports (keep these at the very top) ---
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';

// Set a default session secret for development
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "tv-tracker-dev-secret-key";
}



const app = express();
// JSON body parsing
app.use(express.json());

// CORS: allow your local Vite and your Netlify site
const allowedOrigins = [
  'http://localhost:5173',                 // local React dev
  'https://YOUR-NETLIFY-SITE.netlify.app'  // <-- replace with your real Netlify URL later
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
const PgSession = connectPgSimple(session);

// Needed when running behind Render's proxy to use secure cookies
app.set('trust proxy', 1);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL!,   // your Neon connection string from .env
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET!,      // from .env (or the dev fallback above)
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // true on Render
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}));

app.get('/health', (_req, res) => res.json({ ok: true }));


app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
