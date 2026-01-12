import catalog from "./text_generation.json";

export type ProviderProtocol = "openai" | "anthropic" | "gemini";

export type ProviderDefinition = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl?: string;
  models: string[];
};

export type TextGenerationProvider = {
  id: string;
  protocol?: ProviderProtocol;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  headers?: Record<string, string>;
};

export type TextGenerationRequest = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  signal?: AbortSignal;
};

export type TextGenerationUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type TextGenerationResult = {
  text: string;
  providerId: string;
  model?: string;
  usage?: TextGenerationUsage;
  raw?: unknown;
};

export type TextGenerationStreamHandlers = {
  onChunk?: (delta: string) => void;
  onComplete?: (text: string, raw?: unknown) => void;
  onError?: (error: Error) => void;
};

const providerDefinitions = (catalog as {providers: ProviderDefinition[]}).providers;

// 返回支持的 Provider 定义列表
export const listProviderDefinitions = (): ProviderDefinition[] => {
  return [...providerDefinitions];
};

// 根据 id 查找 Provider 定义
export const findProviderDefinition = (id: string): ProviderDefinition | undefined => {
  return providerDefinitions.find((provider) => provider.id === id);
};

// 规范化 baseUrl，去掉尾部多余斜杠
const normalizeBaseUrl = (value?: string, fallback?: string) => {
  const raw = value || fallback || "";
  return raw.replace(/\/+$/, "");
};

// 解析协议，优先 provider 配置，其次定义，默认 openai
const resolveProviderProtocol = (provider: TextGenerationProvider): ProviderProtocol => {
  const fromProvider = provider.protocol;
  if (fromProvider) return fromProvider;
  const definition = findProviderDefinition(provider.id);
  if (definition?.protocol) return definition.protocol;
  return "openai";
};

// 解析模型名，顺序：request > provider > 定义默认
const resolveModel = (provider: TextGenerationProvider, request: TextGenerationRequest): string => {
  const model = request.model || provider.model;
  if (model) return model;
  const definition = findProviderDefinition(provider.id);
  return definition?.models?.[0] || "gpt-4o-mini";
};

// 文本生成统一入口，按协议分发到具体实现
export async function text_generation(
  provider: TextGenerationProvider,
  request: TextGenerationRequest,
  handlers: TextGenerationStreamHandlers = {}
): Promise<TextGenerationResult> {
  if (!request.prompt.trim()) {
    throw new Error("Prompt is empty");
  }
  if (!provider.apiKey) {
    throw new Error(`Provider ${provider.id} is missing apiKey`);
  }

  const protocol = resolveProviderProtocol(provider);
  const model = resolveModel(provider, request);

  switch (protocol) {
    case "openai":
      return openaiTextGeneration(provider, request, model, handlers);
    case "anthropic":
      return anthropicTextGeneration(provider, request, model, handlers);
    case "gemini":
      return geminiTextGeneration(provider, request, model, handlers);
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

type SseEvent = {event?: string; data: string};

// 通用 SSE 消费器：拆分事件块并回调
const consumeSse = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = chunk.split("\n");
      let eventName: string | undefined;
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length > 0) {
        onEvent({event: eventName, data: dataLines.join("\n")});
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
};

const openaiTextGeneration = async (
  provider: TextGenerationProvider,
  request: TextGenerationRequest,
  model: string,
  handlers: TextGenerationStreamHandlers
): Promise<TextGenerationResult> => {
  // OpenAI 兼容调用（支持流式/非流式）
  const baseUrl = normalizeBaseUrl(provider.baseUrl, findProviderDefinition(provider.id)?.baseUrl || "https://api.openai.com/v1");
  const url = `${baseUrl}/chat/completions`;
  const messages = [
    ...(request.systemPrompt ? [{role: "system", content: request.systemPrompt}] : []),
    {role: "user", content: request.prompt},
  ];
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    top_p: request.topP,
    stream: Boolean(request.stream),
  };
  const headers = {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
    ...(provider.headers || {}),
  };

  if (!request.stream) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || response.statusText;
      throw new Error(`OpenAI request failed: ${message}`);
    }
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    return {
      text,
      providerId: provider.id,
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal: request.signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || response.statusText;
    throw new Error(`OpenAI stream failed: ${message}`);
  }

  let fullText = "";
  let lastChunk: any = undefined;
  await consumeSse(response.body, (event) => {
    if (event.data === "[DONE]") return;
    try {
      const parsed = JSON.parse(event.data);
      lastChunk = parsed;
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        fullText += delta;
        handlers.onChunk?.(delta);
      }
    } catch {
      // ignore parse errors
    }
  });

  handlers.onComplete?.(fullText, lastChunk);
  return {
    text: fullText,
    providerId: provider.id,
    model: lastChunk?.model || model,
    raw: lastChunk,
  };
};

const anthropicTextGeneration = async (
  provider: TextGenerationProvider,
  request: TextGenerationRequest,
  model: string,
  handlers: TextGenerationStreamHandlers
): Promise<TextGenerationResult> => {
  // Anthropic Claude 调用（支持流式/非流式）
  const baseUrl = normalizeBaseUrl(provider.baseUrl, findProviderDefinition(provider.id)?.baseUrl || "https://api.anthropic.com");
  const url = `${baseUrl}/v1/messages`;
  const payload: Record<string, unknown> = {
    model,
    max_tokens: request.maxTokens ?? 1024,
    messages: [{role: "user", content: request.prompt}],
    temperature: request.temperature,
    top_p: request.topP,
    stream: Boolean(request.stream),
  };
  if (request.systemPrompt) {
    payload.system = request.systemPrompt;
  }

  const headers = {
    "x-api-key": provider.apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    ...(provider.headers || {}),
  };

  if (!request.stream) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || response.statusText;
      throw new Error(`Anthropic request failed: ${message}`);
    }
    const content = Array.isArray(data?.content) ? data.content : [];
    const text = content.map((item: any) => item?.text).filter(Boolean).join("");
    return {
      text,
      providerId: provider.id,
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
      raw: data,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal: request.signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || response.statusText;
    throw new Error(`Anthropic stream failed: ${message}`);
  }

  let fullText = "";
  let lastEvent: any = undefined;
  await consumeSse(response.body, (event) => {
    if (!event.data || event.data === "[DONE]") return;
    try {
      const parsed = JSON.parse(event.data);
      lastEvent = parsed;
      if (parsed?.type === "content_block_delta") {
        const delta = parsed?.delta?.text;
        if (typeof delta === "string" && delta.length > 0) {
          fullText += delta;
          handlers.onChunk?.(delta);
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  handlers.onComplete?.(fullText, lastEvent);
  return {
    text: fullText,
    providerId: provider.id,
    model,
    raw: lastEvent,
  };
};


const geminiTextGeneration = async (
  provider: TextGenerationProvider,
  request: TextGenerationRequest,
  model: string,
  handlers: TextGenerationStreamHandlers
): Promise<TextGenerationResult> => {
  // Google Gemini 调用（支持流式/非流式）
  const baseUrl = normalizeBaseUrl(provider.baseUrl, findProviderDefinition(provider.id)?.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
  const payload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{text: request.prompt}],
      },
    ],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      topP: request.topP,
    },
  };
  if (request.systemPrompt) {
    payload.systemInstruction = {parts: [{text: request.systemPrompt}]};
  }

  if (!request.stream) {
    const url = `${baseUrl}/models/${model}:generateContent?key=${provider.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(provider.headers || {}),
      },
      body: JSON.stringify(payload),
      signal: request.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || response.statusText;
      throw new Error(`Gemini request failed: ${message}`);
    }
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    return {
      text,
      providerId: provider.id,
      model,
      raw: data,
    };
  }

  const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${provider.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(provider.headers || {}),
    },
    body: JSON.stringify(payload),
    signal: request.signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || response.statusText;
    throw new Error(`Gemini stream failed: ${message}`);
  }

  let fullText = "";
  let lastChunk: any = undefined;
  await consumeSse(response.body, (event) => {
    if (event.data === "[DONE]") return;
    try {
      const parsed = JSON.parse(event.data);
      lastChunk = parsed;
      const delta = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof delta === "string" && delta.length > 0) {
        fullText += delta;
        handlers.onChunk?.(delta);
      }
    } catch {
      // ignore parse errors
    }
  });

  handlers.onComplete?.(fullText, lastChunk);
  return {
    text: fullText,
    providerId: provider.id,
    model,
    raw: lastChunk,
  };
};
