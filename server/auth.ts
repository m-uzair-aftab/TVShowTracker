import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

// Extend Express Request to include userId from JWT
declare global {
  namespace Express {
    interface Request { userId?: number }
  }
}

function getAuthSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET or SESSION_SECRET must be set in production');
  }
  return 'tv-tracker-local-dev-secret';
}

// JWT token functions
export function signToken(userId: number) {
  const secret = getAuthSecret();
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const secret = getAuthSecret();
    return jwt.verify(token, secret) as { userId: number };
  } catch {
    return null;
  }
}

function getUserIdFromRequest(req: Request): number | undefined {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/i);
  if (!match) return undefined;

  const payload = verifyToken(match[1]);
  return payload?.userId;
}

// JWT auth middleware
export function authHybrid(req: Request, res: Response, next: NextFunction) {
  const userId = getUserIdFromRequest(req);
  if (userId) {
    req.userId = userId;
    return next();
  }

  return res.status(401).json({ message: 'Authentication required' });
}

export function setupAuth(app: express.Express) {
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
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'Logged out successfully' });
  });

  // Get current user endpoint
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
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
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  req.userId = userId;
  next();
}
