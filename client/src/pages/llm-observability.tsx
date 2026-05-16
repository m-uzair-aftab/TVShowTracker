import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, Loader2, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LlmCallStatus = 'success' | 'error';

type LlmCallLog = {
  id: number;
  userId: number | null;
  provider: string;
  operation: string;
  model: string;
  promptVersion: string | null;
  requestPayload: unknown;
  outputText: string | null;
  rawResponse: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number;
  status: LlmCallStatus;
  errorStage: string | null;
  errorMessage: string | null;
  errorStatusCode: number | null;
  errorBody: string | null;
  createdAt: string;
  user: {
    id: number;
    username: string | null;
    displayName: string;
    email: string;
  } | null;
};

type LlmCallsResponse = {
  logs: LlmCallLog[];
  total: number;
};

type LlmSummaryResponse = {
  totalCalls: number;
  successfulCalls: number;
  erroredCalls: number;
  averageResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  byModel: Array<{
    model: string;
    totalCalls: number;
    erroredCalls: number;
    averageResponseTimeMs: number | null;
  }>;
  recentErrors: Array<{
    errorStage: string | null;
    errorMessage: string | null;
    count: number;
    lastSeenAt: string;
  }>;
};

const PAGE_SIZE = 25;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNumber(value: number | null) {
  return value == null ? 'not reported' : new Intl.NumberFormat().format(value);
}

function formatMs(value: number | null) {
  return value == null ? 'not reported' : `${new Intl.NumberFormat().format(value)} ms`;
}

function truncate(value: string | null, length = 96) {
  if (!value) return 'None';
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function prettyJson(value: unknown) {
  if (value == null) return 'None';
  return JSON.stringify(value, null, 2);
}

function dateToIso(date: string, endOfDay = false) {
  if (!date) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  return new Date(`${date}${suffix}`).toISOString();
}

function LogDetails({ log }: { log: LlmCallLog }) {
  return (
    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-xl">LLM call #{log.id}</DialogTitle>
        <DialogDescription>
          {log.operation} on {formatDateTime(log.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium">User</div>
          <div className="text-muted-foreground">
            {log.user ? `${log.user.displayName} (${log.user.email})` : 'Unknown user'}
          </div>
        </div>
        <div>
          <div className="font-medium">Model</div>
          <div className="text-muted-foreground">{log.model}</div>
        </div>
        <div>
          <div className="font-medium">Tokens</div>
          <div className="text-muted-foreground">
            {formatNumber(log.inputTokens)} in / {formatNumber(log.outputTokens)} out
          </div>
        </div>
        <div>
          <div className="font-medium">Response time</div>
          <div className="text-muted-foreground">{formatMs(log.responseTimeMs)}</div>
        </div>
      </div>

      {log.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {log.errorStage || 'error'}: {log.errorMessage || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Request payload</Label>
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
          {prettyJson(log.requestPayload)}
        </pre>
      </div>

      <div className="space-y-2">
        <Label>Output</Label>
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
          {log.outputText || 'None'}
        </pre>
      </div>

      {log.errorBody && (
        <div className="space-y-2">
          <Label>Error body</Label>
          <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
            {log.errorBody}
          </pre>
        </div>
      )}

      <div className="space-y-2">
        <Label>Raw response</Label>
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
          {prettyJson(log.rawResponse)}
        </pre>
      </div>
    </DialogContent>
  );
}

export default function LlmObservabilityPage() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [model, setModel] = useState('');
  const [operation, setOperation] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<'all' | LlmCallStatus>('all');
  const [offset, setOffset] = useState(0);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(offset),
    };

    const from = dateToIso(fromDate);
    const to = dateToIso(toDate, true);
    if (from) params.from = from;
    if (to) params.to = to;
    if (model.trim()) params.model = model.trim();
    if (operation.trim()) params.operation = operation.trim();
    if (userId.trim()) params.userId = userId.trim();
    if (status !== 'all') params.status = status;

    return params;
  }, [fromDate, model, offset, operation, status, toDate, userId]);

  const summaryParams = useMemo(() => {
    const { limit: _limit, offset: _offset, ...summary } = queryParams;
    return summary;
  }, [queryParams]);

  const callsQuery = useQuery<LlmCallsResponse>({
    queryKey: ['/api/observability/llm-calls', queryParams],
    enabled: Boolean(user?.isObservabilityAdmin),
  });

  const summaryQuery = useQuery<LlmSummaryResponse>({
    queryKey: ['/api/observability/llm-summary', summaryParams],
    enabled: Boolean(user?.isObservabilityAdmin),
  });

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setModel('');
    setOperation('');
    setUserId('');
    setStatus('all');
    setOffset(0);
  };

  if (!user?.isObservabilityAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Observability admin access is required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const logs = callsQuery.data?.logs ?? [];
  const total = callsQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">LLM Observability</h2>
          <p className="text-sm text-muted-foreground mt-1">Raw calls and aggregate model behavior.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            callsQuery.refetch();
            summaryQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from-date">From</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={(event) => {
              setFromDate(event.target.value);
              setOffset(0);
            }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date">To</Label>
            <Input id="to-date" type="date" value={toDate} onChange={(event) => {
              setToDate(event.target.value);
              setOffset(0);
            }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => {
              setStatus(value as 'all' | LlmCallStatus);
              setOffset(0);
            }}>
              <SelectTrigger id="status">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={model} onChange={(event) => {
              setModel(event.target.value);
              setOffset(0);
            }} placeholder="model name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operation">Operation</Label>
            <Input id="operation" value={operation} onChange={(event) => {
              setOperation(event.target.value);
              setOffset(0);
            }} placeholder="tv_taste_profile" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-id">User ID</Label>
            <Input id="user-id" inputMode="numeric" value={userId} onChange={(event) => {
              setUserId(event.target.value);
              setOffset(0);
            }} placeholder="7" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button type="button" variant="ghost" onClick={resetFilters}>
            <Search className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="raw">Raw Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {summaryQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : summaryQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>Failed to load LLM summary.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total calls</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{formatNumber(summaryQuery.data?.totalCalls ?? 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Errors</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{formatNumber(summaryQuery.data?.erroredCalls ?? 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average response</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{formatMs(summaryQuery.data?.averageResponseTimeMs ?? null)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total tokens</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{formatNumber(summaryQuery.data?.totalTokens ?? null)}</CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead>Calls</TableHead>
                        <TableHead>Errors</TableHead>
                        <TableHead>Avg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryQuery.data?.byModel.length ? summaryQuery.data.byModel.map((row) => (
                        <TableRow key={row.model}>
                          <TableCell className="font-medium">{row.model}</TableCell>
                          <TableCell>{formatNumber(row.totalCalls)}</TableCell>
                          <TableCell>{formatNumber(row.erroredCalls)}</TableCell>
                          <TableCell>{formatMs(row.averageResponseTimeMs)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No model activity found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Error</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryQuery.data?.recentErrors.length ? summaryQuery.data.recentErrors.map((row) => (
                        <TableRow key={`${row.errorStage}-${row.errorMessage}`}>
                          <TableCell>
                            <div className="font-medium">{row.errorStage || 'error'}</div>
                            <div className="text-xs text-muted-foreground">{truncate(row.errorMessage, 72)}</div>
                          </TableCell>
                          <TableCell>{formatNumber(row.count)}</TableCell>
                          <TableCell>{formatDateTime(row.lastSeenAt)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No recent errors found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="raw" className="space-y-4">
          {callsQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : callsQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>Failed to load LLM call logs.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Output / Error</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length ? logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'outline' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.user?.displayName || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{log.user?.email || `User ${log.userId ?? 'unknown'}`}</div>
                        </TableCell>
                        <TableCell>{log.operation}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{log.model}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatNumber(log.inputTokens)} / {formatNumber(log.outputTokens)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatMs(log.responseTimeMs)}</TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="truncate">
                            {log.status === 'error' ? truncate(log.errorMessage, 120) : truncate(log.outputText, 120)}
                          </div>
                          {log.errorStage && <div className="text-xs text-muted-foreground">{log.errorStage}</div>}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`View LLM call ${log.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <LogDetails log={log} />
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                          No LLM calls found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} · {formatNumber(total)} calls
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
