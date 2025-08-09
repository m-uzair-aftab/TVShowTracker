import React from 'react';
import { Link } from 'wouter';

interface LinkWithSourceProps {
  to: string;
  source: string;
  children: React.ReactNode;
  className?: string;
}

// Component to create links that maintain context through URL parameters
export function LinkWithSource({ to, source, children, className }: LinkWithSourceProps) {
  return (
    <Link href={`${to}?source=${source}`} className={className}>
      {children}
    </Link>
  );
}