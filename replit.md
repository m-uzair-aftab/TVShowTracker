# TV Show Tracker Application

## Overview

This is a full-stack TV show tracking application built with Express.js backend and React frontend. Users can search for TV shows via the TVmaze API, add them to their personal watchlist, and track their viewing progress including season-by-season completion with ratings and grades.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend:

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/UI components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds
- **Form Handling**: React Hook Form with Zod validation

### Backend (Node.js/Express)
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based auth with bcrypt password hashing
- **External API**: TVmaze API integration for show data

## Key Components

### Database Schema
- **Users**: User authentication and profile data
- **TV Shows**: Show metadata (title, seasons, episodes, ratings, etc.)
- **User Watchlists**: Many-to-many relationship between users and shows
- **Season Progress**: Detailed tracking of viewing progress per season

### Authentication System
- Session-based authentication using express-session
- Password hashing with bcrypt
- Protected routes on both frontend and backend
- User registration and login endpoints

### External API Integration
- TVmaze API for searching and fetching show details
- Automatic mapping of external data to internal schema
- Caching of show data in local database
- Fallback handling for missing images/data

### Frontend Architecture
- Component-based architecture with reusable UI components
- Custom hooks for authentication state management
- Protected routing system
- Form validation with Zod schemas
- Responsive design with mobile-first approach

## Data Flow

1. **User Authentication**: Users register/login through forms that validate against Zod schemas
2. **Show Search**: Frontend queries backend which fetches from TVmaze API and caches results
3. **Watchlist Management**: Users can add/remove shows with immediate UI updates via optimistic updates
4. **Progress Tracking**: Season-by-season progress tracking with ratings and completion dates
5. **Data Persistence**: All user data stored in PostgreSQL with type-safe Drizzle queries

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router
- **zod**: Runtime type validation
- **bcrypt**: Password hashing

### UI Dependencies
- **@radix-ui/react-***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **date-fns**: Date manipulation utilities

### Development Dependencies
- **vite**: Build tool and dev server
- **typescript**: Type checking
- **esbuild**: Fast bundling for production

## Deployment Strategy

The application is configured for deployment on Replit with:

- **Development**: `npm run dev` starts both frontend and backend
- **Production Build**: `npm run build` creates optimized bundles
- **Production Start**: `npm run start` runs the built application
- **Database Migrations**: `npm run db:push` applies schema changes

### Replit Configuration
- Uses Replit's built-in PostgreSQL for database
- Configured for autoscale deployment
- Serves static files from Express in production
- Environment variables for database connection and session secrets

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 22, 2025. Initial setup