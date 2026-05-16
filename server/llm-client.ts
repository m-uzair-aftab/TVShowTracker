import { storage } from "./storage";

export type LlmClientStage =
  | "config"
  | "provider_request"
  | "provider_http"
  | "provider_response"
  | "observability_log";

type LlmClientErrorInput = {
  stage: LlmClientStage;
  provider: string;
  model: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  isProviderUnavailable?: boolean;
  cause?: unknown;
};

export class LlmClientError extends Error {
  stage: LlmClientStage;
  provider: string;
  model: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  isProviderUnavailable: boolean;
  originalError?: unknown;

  constructor(message: string, input: LlmClientErrorInput) {
    super(message);
    this.name = "LlmClientError";
    this.stage = input.stage;
    this.provider = input.provider;
    this.model = input.model;
    this.upstreamStatus = input.upstreamStatus;
    this.upstreamBody = input.upstreamBody;
    this.isProviderUnavailable = input.isProviderUnavailable ?? false;
    this.originalError = input.cause;
  }
}

export function isLlmClientError(error: unknown): error is LlmClientError {
  return error instanceof LlmClientError;
}

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatCompletionRequest = {
  messages: LlmChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: false;
};

type OpenAiCompatibleChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type ObservedChatCompletionInput = {
  userId: number;
  operation: string;
  promptVersion?: string;
  request: LlmChatCompletionRequest;
};

const LLM_LOG_RETENTION_DAYS = 90;

function getNvidiaConfig() {
  const baseUrl = process.env.NVIDIA_BASE_URL;
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("NVIDIA AI configuration is incomplete.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model,
  };
}

function isProviderUnavailable(status?: number, body?: string, statusText?: string) {
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  const text = `${body ?? ""} ${statusText ?? ""}`.toLowerCase();
  return [
    "resourceexhausted",
    "resource exhausted",
    "service unavailable",
    "temporarily unavailable",
    "all workers are busy",
    "workers are busy",
    "please retry later",
    "overloaded",
    "capacity",
  ].some((needle) => text.includes(needle));
}

function getRetentionCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LLM_LOG_RETENTION_DAYS);
  return cutoff;
}

async function persistLlmLog(input: Parameters<typeof storage.createLlmCallLog>[0]) {
  try {
    const log = await storage.createLlmCallLog(input);
    await storage.pruneOldLlmCallLogs(getRetentionCutoff());
    return log;
  } catch (error) {
    throw new LlmClientError("Failed to persist LLM observability log.", {
      stage: "observability_log",
      provider: input.provider,
      model: input.model,
      cause: error,
    });
  }
}

export async function createNvidiaChatCompletion(input: ObservedChatCompletionInput) {
  const provider = "nvidia";
  let config: ReturnType<typeof getNvidiaConfig>;

  try {
    config = getNvidiaConfig();
  } catch (error) {
    throw new LlmClientError("NVIDIA AI configuration is incomplete.", {
      stage: "config",
      provider,
      model: process.env.NVIDIA_MODEL ?? "unknown",
      cause: error,
    });
  }

  const requestPayload = {
    model: config.model,
    ...input.request,
  };
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;
    await persistLlmLog({
      userId: input.userId,
      provider,
      operation: input.operation,
      model: config.model,
      promptVersion: input.promptVersion ?? null,
      requestPayload,
      outputText: null,
      rawResponse: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      status: "error",
      errorStage: "provider_request",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStatusCode: null,
      errorBody: null,
    });

    throw new LlmClientError("NVIDIA provider request failed.", {
      stage: "provider_request",
      provider,
      model: config.model,
      isProviderUnavailable: true,
      cause: error,
    });
  }

  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    const errorText = await response.text();
    await persistLlmLog({
      userId: input.userId,
      provider,
      operation: input.operation,
      model: config.model,
      promptVersion: input.promptVersion ?? null,
      requestPayload,
      outputText: null,
      rawResponse: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      status: "error",
      errorStage: "provider_http",
      errorMessage: response.statusText || "Provider returned an unsuccessful response.",
      errorStatusCode: response.status,
      errorBody: errorText,
    });

    throw new LlmClientError("NVIDIA provider returned an unsuccessful response.", {
      stage: "provider_http",
      provider,
      model: config.model,
      upstreamStatus: response.status,
      upstreamBody: errorText,
      isProviderUnavailable: isProviderUnavailable(response.status, errorText, response.statusText),
    });
  }

  const responseText = await response.text();
  let data: OpenAiCompatibleChatCompletionResponse;

  try {
    data = JSON.parse(responseText) as OpenAiCompatibleChatCompletionResponse;
  } catch (error) {
    await persistLlmLog({
      userId: input.userId,
      provider,
      operation: input.operation,
      model: config.model,
      promptVersion: input.promptVersion ?? null,
      requestPayload,
      outputText: null,
      rawResponse: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      responseTimeMs,
      status: "error",
      errorStage: "provider_response",
      errorMessage: "Provider returned invalid JSON.",
      errorStatusCode: null,
      errorBody: responseText,
    });

    throw new LlmClientError("NVIDIA provider returned invalid JSON.", {
      stage: "provider_response",
      provider,
      model: config.model,
      upstreamBody: responseText,
      cause: error,
    });
  }

  const outputText = data.choices?.[0]?.message?.content ?? null;

  const log = await persistLlmLog({
    userId: input.userId,
    provider,
    operation: input.operation,
    model: config.model,
    promptVersion: input.promptVersion ?? null,
    requestPayload,
    outputText,
    rawResponse: data,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    totalTokens: data.usage?.total_tokens ?? null,
    responseTimeMs,
    status: "success",
    errorStage: null,
    errorMessage: null,
    errorStatusCode: null,
    errorBody: null,
  });

  return {
    logId: log.id,
    model: config.model,
    response: data,
    content: outputText,
  };
}
