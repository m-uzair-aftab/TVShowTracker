import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain, ChevronDown, ChevronUp, Clock, Compass, Layers, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { AiInsightSourceSummary, AiTasteProfile } from '@shared/schema';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type AiInsightResponse = {
  insight: TvTasteProfileInsight | null;
};

type TvTasteProfileInsight = {
  id: number;
  profile: unknown;
  sourceSummary: AiInsightSourceSummary;
  model: string;
  promptVersion: string;
  generatedAt: string;
  updatedAt: string;
};

const TV_TASTE_PROFILE_QUERY_KEY = ['/api/ai-insights/tv/taste-profile'];
const TV_TASTE_PROFILE_PROMPT_VERSION = 'tv-taste-profile-v3';
const MAX_PATTERN_ITEMS = 5;
const MAX_DISCOVERY_ITEMS = 5;
const MAX_RECENT_TREND_ITEMS = 4;
const LLM_PROVIDER_UNAVAILABLE_MESSAGE = 'Unable to temporarily reach LLM provider. Try again later.';

function getProfileGenerationErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'LLM_PROVIDER_UNAVAILABLE') {
    return LLM_PROVIDER_UNAVAILABLE_MESSAGE;
  }

  if (error instanceof ApiError && error.message) {
    return error.message;
  }

  return 'Failed to generate TV taste profile. Please try again later.';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTasteProfileV2(profile: unknown): profile is AiTasteProfile {
  if (!profile || typeof profile !== 'object') return false;
  const candidate = profile as Record<string, unknown>;

  return typeof candidate.tasteSummary === 'string'
    && isStringArray(candidate.topGenres)
    && isStringArray(candidate.favoritePatterns)
    && isStringArray(candidate.discoveryLanes)
    && (candidate.recentTrends === undefined || isStringArray(candidate.recentTrends));
}

function InsightSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-primary/10 bg-primary/5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <Skeleton className="h-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightTile({
  icon,
  children,
  tone,
}: {
  icon: ReactNode;
  children: string;
  tone: 'warm' | 'cool' | 'fresh';
}) {
  const toneClasses = {
    warm: {
      tile: 'border-amber-200/70 bg-amber-50/70 text-amber-950',
      icon: 'text-amber-600',
    },
    cool: {
      tile: 'border-sky-200/70 bg-sky-50/70 text-sky-950',
      icon: 'text-sky-600',
    },
    fresh: {
      tile: 'border-emerald-200/70 bg-emerald-50/70 text-emerald-950',
      icon: 'text-emerald-600',
    },
  }[tone];

  return (
    <div className={`flex gap-3 rounded-md border p-3 ${toneClasses.tile}`}>
      <div className={`mt-0.5 ${toneClasses.icon}`}>{icon}</div>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function TasteProfileContent({ profile }: { profile: AiTasteProfile }) {
  const favoritePatterns = profile.favoritePatterns.filter(Boolean).slice(0, MAX_PATTERN_ITEMS);
  const discoveryLanes = profile.discoveryLanes.filter(Boolean).slice(0, MAX_DISCOVERY_ITEMS);
  const recentTrends = (profile.recentTrends?.filter(Boolean) ?? []).slice(0, MAX_RECENT_TREND_ITEMS);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title="Your TV Taste"
          description="A quick read on what someone should recommend to you."
          icon={<Sparkles className="h-4 w-4" />}
        />
        <p className="max-w-4xl text-base leading-relaxed text-foreground">
          {profile.tasteSummary}
        </p>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Top Genres" icon={<Layers className="h-4 w-4" />} />
        <div className="flex flex-wrap gap-2">
          {profile.topGenres.map((genre) => (
            <Badge key={genre} variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              {genre}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader
            title="Favorite Patterns"
            description="Traits your watched and rated shows suggest you already enjoy."
            icon={<Sparkles className="h-4 w-4" />}
          />
          <div className="grid gap-3">
            {favoritePatterns.map((pattern, index) => (
              <InsightTile key={`${pattern}-${index}`} icon={<Sparkles className="h-4 w-4" />} tone="warm">
                {pattern}
              </InsightTile>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Discovery Lanes"
            description="Directions your taste could explore next."
            icon={<Compass className="h-4 w-4" />}
          />
          <div className="grid gap-3">
            {discoveryLanes.map((lane, index) => (
              <InsightTile key={`${lane}-${index}`} icon={<Compass className="h-4 w-4" />} tone="cool">
                {lane}
              </InsightTile>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Recent Trends"
          description="Shifts that show up in your more recent activity."
          icon={<TrendingUp className="h-4 w-4" />}
        />
        {recentTrends.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recentTrends.map((trend, index) => (
              <InsightTile key={`${trend}-${index}`} icon={<TrendingUp className="h-4 w-4" />} tone="fresh">
                {trend}
              </InsightTile>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            Not enough dated activity yet to call a clear trend.
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshProfileState({
  generatedAt,
}: {
  generatedAt?: string;
}) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/5 p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-4 text-lg font-medium">Refresh your taste card</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your saved profile uses an older format. Regenerate it to get the shorter, more personal version.
      </p>
      {generatedAt && (
        <p className="mt-3 text-xs text-muted-foreground">Last generated {formatDateTime(generatedAt)}</p>
      )}
    </div>
  );
}

function EmptyProfileState() {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/5 py-12 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-4 text-lg font-medium">No taste card yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Generate a short TV taste card from your watched seasons, ratings, genres, and activity.
      </p>
    </div>
  );
}

function TasteProfileSection() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const { data, isLoading, error } = useQuery<AiInsightResponse>({
    queryKey: TV_TASTE_PROFILE_QUERY_KEY,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai-insights/tv/taste-profile/regenerate');
      return response.json() as Promise<AiInsightResponse>;
    },
    onSuccess: (response) => {
      queryClient.setQueryData(TV_TASTE_PROFILE_QUERY_KEY, response);
      toast({
        title: 'Taste card generated',
        description: 'Your TV taste profile has been saved.',
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Could not generate profile',
        description: getProfileGenerationErrorMessage(mutationError),
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <InsightSkeleton />;
  }

  const insight = data?.insight ?? null;
  const profile = isTasteProfileV2(insight?.profile) ? insight.profile : null;
  const isOutdated = Boolean(insight && (insight.promptVersion !== TV_TASTE_PROFILE_PROMPT_VERSION || !profile));
  const actionLabel = profile ? 'Regenerate' : isOutdated ? 'Regenerate profile' : 'Generate taste card';
  const actionIcon = regenerateMutation.isPending
    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
    : profile || isOutdated
      ? <RefreshCw className="h-3.5 w-3.5" />
      : <Sparkles className="h-3.5 w-3.5" />;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b border-primary/10 bg-primary/5 md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Taste profile
            </CardTitle>
            <CardDescription className="mt-2">
              A recommendation-ready read on what your TV history says about you.
            </CardDescription>
          </div>
          <div className="flex w-full md:w-auto">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-background/80 md:w-auto"
                aria-label={isOpen ? 'Collapse taste profile' : 'Expand taste profile'}
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isOpen ? 'Collapse' : 'Expand'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to load taste profile</AlertTitle>
                <AlertDescription>Please refresh the page and try again.</AlertDescription>
              </Alert>
            )}

            {regenerateMutation.isError && insight && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Previous profile kept</AlertTitle>
                <AlertDescription>The latest generation failed, so your saved profile was not changed.</AlertDescription>
              </Alert>
            )}

            {profile ? (
              <TasteProfileContent profile={profile} />
            ) : isOutdated ? (
              <RefreshProfileState
                generatedAt={insight?.generatedAt}
              />
            ) : (
              <EmptyProfileState />
            )}

            <div className="mt-6 flex justify-end">
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                  variant={profile ? 'outline' : 'default'}
                  size="sm"
                  className={profile ? 'h-8 bg-background/80 px-2.5 text-xs [&_svg]:size-3.5' : 'h-8 px-2.5 text-xs [&_svg]:size-3.5'}
                >
                  {actionIcon}
                  {regenerateMutation.isPending ? 'Generating' : actionLabel}
                </Button>
                {profile && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Generated {formatDateTime(insight!.generatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function AIInsights() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">AI Insights</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Short, saved insights generated from your personal TV history.
        </p>
      </div>
      <TasteProfileSection />
    </section>
  );
}
