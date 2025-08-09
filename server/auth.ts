import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { storage } from './storage';

// Extend the Express session with our own types
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
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

      // Set session
      req.session.userId = user.id;
      
      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
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

      // Set session
      req.session.userId = user.id;
      
      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
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
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
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