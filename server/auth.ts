import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

// Extend the Express session with our own types
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

// Extend Express Request to include userId from JWT
declare global {
  namespace Express {
    interface Request { userId?: number }
  }
}

// JWT token functions
export function signToken(userId: number) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-only-placeholder';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-only-placeholder';
    return jwt.verify(token, secret) as { userId: number };
  } catch {
    return null;
  }
}

// Hybrid auth middleware that accepts both JWT tokens and sessions
export function authHybrid(req: Request, res: Response, next: NextFunction) {
  // 1) Try JWT token from Authorization header
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/i);
  if (m) {
    const payload = verifyToken(m[1]);
    if (payload) {
      req.userId = payload.userId;
      return next();
    }
  }
  
  // 2) Fallback to session (existing path)
  if (req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }
  
  return res.status(401).json({ message: 'Authentication required' });
}

export function setupAuth(app: express.Express) {
  // Setup session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-only-placeholder',
      resave: false,
      saveUninitialized: false,
      cookie: {
        // Set secure to false to make it work on Replit
        secure: false, 
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      }
    })
  );

  // Registration endpoint
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null
      });

      // Set session (for backward compatibility)
      req.session.userId = user.id;
      
      // Generate JWT token
      const token = signToken(user.id);
      
      // Return user data with token (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ token, user: userWithoutPassword });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to register user' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Set session (for backward compatibility)
      req.session.userId = user.id;
      
      // Generate JWT token
      const token = signToken(user.id);
      
      // Return user data with token (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json({ token, user: userWithoutPassword });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Failed to login' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });

  // Get current user endpoint
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      // Use authHybrid middleware logic here
      let userId: number | undefined;
      
      // 1) Try JWT token from Authorization header
      const auth = req.headers.authorization || '';
      const m = auth.match(/^Bearer (.+)$/i);
      if (m) {
        const payload = verifyToken(m[1]);
        if (payload) {
          userId = payload.userId;
        }
      }
      
      // 2) Fallback to session
      if (!userId && req.session.userId) {
        userId = req.session.userId;
      }
      
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        // Clear session if user not found
        if (req.session.userId) {
          req.session.destroy(() => {});
        }
        return res.status(401).json({ message: 'User not found' });
      }

      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Failed to get current user' });
    }
  });
}

// Middleware to check if the user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}