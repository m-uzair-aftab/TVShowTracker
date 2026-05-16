import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Loader2, Save } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ShareSettingsResponse {
  username: string;
  enabled: boolean;
  includeAllYears: boolean;
  sharedYears: string[];
  shareTasteProfiles: boolean;
  availableYears: string[];
  publicPath: string | null;
}

interface SettingsFormState {
  username: string;
  enabled: boolean;
  includeAllYears: boolean;
  sharedYears: string[];
  shareTasteProfiles: boolean;
}

function normalizeYears(years: string[]) {
  return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
}

function formStateFromSettings(settings: ShareSettingsResponse): SettingsFormState {
  return {
    username: settings.username || '',
    enabled: settings.enabled,
    includeAllYears: settings.includeAllYears,
    sharedYears: normalizeYears(settings.sharedYears || []),
    shareTasteProfiles: settings.shareTasteProfiles ?? false,
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [includeAllYears, setIncludeAllYears] = useState(true);
  const [sharedYears, setSharedYears] = useState<string[]>([]);
  const [shareTasteProfiles, setShareTasteProfiles] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SettingsFormState | null>(null);

  const { data, isLoading, error } = useQuery<ShareSettingsResponse>({
    queryKey: ['/api/share-settings'],
  });

  useEffect(() => {
    if (!data) return;
    const nextSettings = formStateFromSettings(data);
    setUsername(nextSettings.username);
    setEnabled(nextSettings.enabled);
    setIncludeAllYears(nextSettings.includeAllYears);
    setSharedYears(nextSettings.sharedYears);
    setShareTasteProfiles(nextSettings.shareTasteProfiles);
    setSavedSettings(nextSettings);
  }, [data]);

  const currentSettings = useMemo<SettingsFormState>(() => ({
    username,
    enabled,
    includeAllYears,
    sharedYears: normalizeYears(sharedYears),
    shareTasteProfiles,
  }), [username, enabled, includeAllYears, sharedYears, shareTasteProfiles]);

  const hasUnsavedChanges = savedSettings !== null
    && JSON.stringify(currentSettings) !== JSON.stringify(savedSettings);

  const publicUrl = useMemo(() => {
    const cleanUsername = username.trim().toLowerCase();
    return cleanUsername ? `${window.location.origin}/${cleanUsername}/shared-list` : '';
  }, [username]);

  const saveMutation = useMutation<ShareSettingsResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest('PATCH', '/api/share-settings', {
        username,
        enabled,
        includeAllYears,
        sharedYears,
        shareTasteProfiles,
      });
      return response.json();
    },
    onSuccess: (updated) => {
      const nextSettings = formStateFromSettings(updated);
      queryClient.setQueryData(['/api/share-settings'], updated);
      setUsername(nextSettings.username);
      setEnabled(nextSettings.enabled);
      setIncludeAllYears(nextSettings.includeAllYears);
      setSharedYears(nextSettings.sharedYears);
      setShareTasteProfiles(nextSettings.shareTasteProfiles);
      setSavedSettings(nextSettings);
      toast({
        title: 'Share settings saved',
        description: updated.enabled ? 'Your shared list is live.' : 'Sharing is turned off.',
      });
    },
    onError: (mutationError) => {
      toast({
        title: 'Could not save settings',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const toggleYear = (year: string, checked: boolean) => {
    setSharedYears((current) => {
      if (checked) {
        return Array.from(new Set([...current, year])).sort((a, b) => Number(b) - Number(a));
      }
      return current.filter((item) => item !== year);
    });
  };

  const copyLink = async () => {
    if (!publicUrl) return;

    await navigator.clipboard.writeText(publicUrl);
    toast({
      title: 'Link copied',
      description: 'The shared list URL is ready to send.',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Failed to load share settings. Please try again later.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage the public version of your TV and movie list.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Shared list</CardTitle>
          <CardDescription>Choose a public handle and the years included in your shared view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="public-handle">Public handle</Label>
            <Input
              id="public-handle"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="uzair"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <Label htmlFor="share-enabled" className="font-medium">Share publicly</Label>
              <p className="text-sm text-muted-foreground mt-1">
                People with the link can view a read-only version of your list.
              </p>
            </div>
            <Switch id="share-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <Label htmlFor="share-taste-profiles" className="font-medium">Share Taste Profiles</Label>
              <p className="text-sm text-muted-foreground mt-1">
                If generated, your TV and movie Taste Profiles can appear on your public shared list.
              </p>
            </div>
            <Switch
              id="share-taste-profiles"
              checked={shareTasteProfiles}
              onCheckedChange={setShareTasteProfiles}
            />
          </div>

          <div className="space-y-3">
            <Label>Years included</Label>
            <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
              <Checkbox
                checked={includeAllYears}
                onCheckedChange={(checked) => setIncludeAllYears(Boolean(checked))}
              />
              <span className="text-sm font-medium">All years</span>
            </label>

            {!includeAllYears && (
              <div className="ml-6 border-l pl-4 py-3 rounded-r-md bg-muted/20">
                <div className="mb-3 text-sm font-medium text-muted-foreground">Specific years</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data?.availableYears.length ? (
                    data.availableYears.map((year) => (
                      <label key={year} className="flex items-center gap-3 rounded-md border bg-background p-3 cursor-pointer">
                        <Checkbox
                          checked={sharedYears.includes(year)}
                          onCheckedChange={(checked) => toggleYear(year, Boolean(checked))}
                        />
                        <span className="text-sm font-medium">{year}</span>
                      </label>
                    ))
                  ) : (
                    <div className="col-span-full text-sm text-muted-foreground rounded-md border bg-background p-3">
                      No activity years found yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-url">Share URL</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input id="share-url" value={publicUrl} readOnly placeholder="Choose a handle to create a link" />
              <Button type="button" variant="outline" onClick={copyLink} disabled={!publicUrl}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasUnsavedChanges}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
