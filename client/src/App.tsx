import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ShowDetails from "@/pages/show-details";
import MoviesHome from "@/pages/movies";
import MovieDetails from "@/pages/movie-details";
import AuthPage from "@/pages/auth-page";
import SettingsPage from "@/pages/settings";
import SharedListPage from "@/pages/shared-list";

function Router() {
  return (
    <Switch>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/:username/shared-list">
        {(params) => <SharedListPage username={params.username} />}
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/search">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/ai-insights">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/show/:id">
        {(params) => (
          <ProtectedRoute>
            <ShowDetails />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/movies">
        <ProtectedRoute>
          <MoviesHome />
        </ProtectedRoute>
      </Route>
      <Route path="/movies/search">
        <ProtectedRoute>
          <MoviesHome />
        </ProtectedRoute>
      </Route>
      <Route path="/movie/:id">
        {(params) => (
          <ProtectedRoute>
            <MovieDetails />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto py-4 px-4 md:px-6">
              <Router />
            </main>
            <Footer />
          </div>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
