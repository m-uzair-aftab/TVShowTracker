import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({
  component: Component,
  ...rest
}: {
  component: React.ComponentType<any>;
  [x: string]: any;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component {...rest} />;
}