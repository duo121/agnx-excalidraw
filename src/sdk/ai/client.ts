import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";
import {nanoid} from "nanoid";

import {loadAppConfig, resolveActiveProvider, resolveProviderApiKey} from "./config";
import {findProviderDefinition, text_generation, type TextGenerationResult, type TextGenerationProvider} from "./text_generation";

import {
  convertDslToJson,
  convertJsonToDsl,
  type DSLCompressedDocument,
} from "../dsl";
import {loadParseMermaidToExcalidraw} from "../utils/mermaid-to-excalidraw-loader";
import {sanitizeExcalidrawElements} from "../utils/sanitize-elements";

import {
  DSL_EDIT_PROMPT_TEMPLATE,
  EXCALIDRAW_JSON_SYSTEM_PROMPT,
  JSON_REPAIR_SYSTEM_PROMPT,
  MERMAID_PROMPT_TEMPLATE,
} from "./prompts";

export type StreamHandlers = {
  onChunk?: (delta: string) => void;
  onComplete?: (text: string, finalResult?: TextGenerationResult) => void;
  onError?: (error: Error) => void;
};

export type MermaidResult = {
  code: string;
};

export type DslEditResult = {
  dsl: string;
  document: DSLCompressedDocument;
};

export type ExcalidrawSceneData = {
  elements: ExcalidrawElement[];
  files?: Record<string, any>;
};

const ensureElementIds = (elements: ExcalidrawElement[]): ExcalidrawElement[] => {
  const remap = new Map<string, string>();
  const normalized = elements.map((element) => {
    const currentId = (element as any)?.id;
    if (isExcalidrawId(currentId)) {
      return {...element};
    }
    const newId = nanoid();
    if (currentId) {
      remap.set(currentId, newId);
    }
    return {...element, id: newId};
  });

  if (!remap.size) {
    return normalized;
  }

  const resolveId = (value?: string | null) => {
    if (!value) return value;
    return remap.get(value) || value;
  };

  return normalized.map((element) => {
    const next: any = {...element};
    if (Array.isArray(next.groupIds)) {
      next.groupIds = next.groupIds.map((groupId: string) => resolveId(groupId) || groupId);
    }
    if (next.containerId) {
      next.containerId = resolveId(next.containerId);
    }
    if (next.frameId) {
      next.frameId = resolveId(next.frameId);
    }
    if (Array.isArray(next.boundElements)) {
      next.boundElements = next.boundElements.map((item: any) => {
        if (!item || typeof item !== "object") return item;
        const nextId = resolveId(item.id);
        if (nextId === item.id) return item;
        return {...item, id: nextId};
      });
    }
    if (next.startBinding) {
      next.startBinding = updateBinding(next.startBinding, resolveId);
    }
    if (next.endBinding) {
      next.endBinding = updateBinding(next.endBinding, resolveId);
    }
    return next as ExcalidrawElement;
  });
};

const updateBinding = (binding: any, resolveId: (value?: string | null) => string | null | undefined) => {
  if (!binding || typeof binding !== "object") return binding;
  const elementId = resolveId(binding.elementId);
  if (elementId === binding.elementId) return binding;
  return {...binding, elementId};
};

const isExcalidrawId = (id?: string | null) => {
  if (!id || typeof id !== "string") return false;
  return id.length >= 20 && /^[A-Za-z0-9_-]+$/.test(id);
};

const sortShortIds = (ids: string[]) => {
  return ids.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na - nb;
    }
    if (!Number.isNaN(na)) return -1;
    if (!Number.isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
};

const calculateIdMapping = (elements: ExcalidrawElement[], providedMap?: Record<string, string>) => {
  const idMap: Record<string, string> = {};
  const elementById = new Map<string, ExcalidrawElement>();
  elements.forEach((element) => {
    if (element?.id) {
      elementById.set(element.id, element);
    }
  });
  let maxId = 0;
  const usedLongIds = new Set<string>();

  const shortIds = providedMap ? sortShortIds(Object.keys(providedMap)) : [];

  if (shortIds.length) {
    shortIds.forEach((shortId) => {
      const longId = providedMap?.[shortId] || shortId;
      idMap[shortId] = longId;
      usedLongIds.add(longId);
      const numeric = Number(shortId);
      if (!Number.isNaN(numeric)) {
        maxId = Math.max(maxId, numeric);
      }
    });

    elements.forEach((element) => {
      const longId = element?.id;
      if (!longId || usedLongIds.has(longId)) {
        return;
      }
      maxId += 1;
      const shortId = String(maxId);
      idMap[shortId] = longId;
      usedLongIds.add(longId);
    });
  } else {
    elements.forEach((element, index) => {
      const shortId = String(index + 1);
      const longId = element?.id || `element_${index + 1}`;
      idMap[shortId] = longId;
      usedLongIds.add(longId);
      maxId = Math.max(maxId, index + 1);
    });
  }

  return {
    idMap,
    nextNewId: maxId + 1,
  };
};

export const extractMermaid = (responseText: string): string => {
  const blockMatch = responseText.match(/```mermaid\s*\n([\s\S]+?)\n```/);
  if (blockMatch) return blockMatch[1].trim();
  if (responseText.includes("graph") || responseText.includes("flowchart") || responseText.includes("sequenceDiagram")) {
    return responseText.trim();
  }
  throw new Error("No Mermaid code found in response");
};

export const extractDsl = (responseText: string): string => {
  const blockMatch = responseText.match(/```(?:dsl|text)?\s*\n([\s\S]+?)\n```/);
  if (blockMatch) return blockMatch[1].trim();
  if (responseText.includes("# excalidraw public-attribute DSL")) {
    return responseText.trim();
  }
  throw new Error("No DSL found in response");
};

const buildMermaidPrompt = (prompt: string) => {
  return MERMAID_PROMPT_TEMPLATE.replace("{{prompt}}", prompt.trim());
};

const buildDslEditPrompt = (
  dsl: string,
  editPrompt: string,
  idMap: Record<string, string>,
  nextNewId: number
): string => {
  const mapLines = Object.entries(idMap)
    .map(([shortId, longId]) => `${shortId} -> ${longId}`)
    .join("\n");

  return DSL_EDIT_PROMPT_TEMPLATE
    .replace("{{dsl}}", dsl)
    .replace("{{idMap}}", mapLines || "(none)")
    .replace(/{{nextId}}/g, String(nextNewId))
    .replace("{{prompt}}", editPrompt.trim());
};

const resolveThemeVars = (isDark: boolean) => {
  return isDark
    ? {
        primaryColor: "#ffffff",
        primaryTextColor: "#ffffff",
        primaryBackgroundColor: "#1e1e1e",
      }
    : {
        primaryColor: "#1e1e1e",
        primaryTextColor: "#1e1e1e",
        primaryBackgroundColor: "#ffffff",
    };
};

const resolveTextProvider = async (): Promise<{
  provider: TextGenerationProvider;
  model: string;
}> => {
  const config = await loadAppConfig();
  const active = resolveActiveProvider(config);
  if (!active?.provider) {
    throw new Error("No active provider configured");
  }

  const providerType = active.provider.type || active.provider.id;
  const definition = findProviderDefinition(providerType);
  const model = active.model || active.provider.models?.[0] || definition?.models?.[0];
  if (!model) {
    throw new Error("No model configured for active provider");
  }
  const apiKey = resolveProviderApiKey(active.provider);
  if (!apiKey) {
    throw new Error("No API key configured for active provider");
  }

  const provider: TextGenerationProvider = {
    id: providerType,
    apiKey,
    baseUrl: active.provider.baseUrl || definition?.baseUrl,
    model,
  };

  return {provider, model};
};

export async function streamExcalidrawJson(prompt: string, handlers: StreamHandlers): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    handlers.onError?.(new Error("Prompt is empty"));
    return;
  }

  try {
    const {provider} = await resolveTextProvider();
    const result = await text_generation(
      provider,
      {
        prompt: trimmed,
        systemPrompt: EXCALIDRAW_JSON_SYSTEM_PROMPT,
        temperature: 1,
        stream: true,
      },
      {
        onChunk: (delta) => handlers.onChunk?.(delta),
      }
    );
    handlers.onComplete?.(result.text, result);
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function streamMermaid(prompt: string, handlers: StreamHandlers): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    handlers.onError?.(new Error("Prompt is empty"));
    return;
  }

  try {
    const {provider} = await resolveTextProvider();
    const result = await text_generation(
      provider,
      {
        prompt: buildMermaidPrompt(trimmed),
        temperature: 0.7,
        stream: true,
      },
      {
        onChunk: (delta) => handlers.onChunk?.(delta),
      }
    );
    handlers.onComplete?.(result.text, result);
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function streamDslEdit(
  currentElements: ExcalidrawElement[],
  editPrompt: string,
  handlers: StreamHandlers
): Promise<void> {
  const trimmedPrompt = editPrompt.trim();
  if (!trimmedPrompt) {
    handlers.onError?.(new Error("Prompt is empty"));
    return;
  }

  try {
    const snapshot = convertJsonToDsl(currentElements);
    const {idMap, nextNewId} = calculateIdMapping(currentElements, snapshot.document.idMap || {});

    const {provider} = await resolveTextProvider();
    const result = await text_generation(
      provider,
      {
        prompt: buildDslEditPrompt(snapshot.dsl, trimmedPrompt, idMap, nextNewId),
        temperature: 0.3,
        stream: true,
      },
      {
        onChunk: (delta) => handlers.onChunk?.(delta),
      }
    );
    handlers.onComplete?.(result.text, result);
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function generateMermaid(prompt: string): Promise<MermaidResult> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is empty");

  const {provider} = await resolveTextProvider();
  const result = await text_generation(provider, {
    prompt: buildMermaidPrompt(trimmed),
    temperature: 0.7,
  });

  const responseText = result.text || "";
  const code = extractMermaid(responseText);
  return {code};
}

export async function convertMermaidToExcalidraw(
  mermaidCode: string,
  options: {isDark?: boolean; preferredStrokeColor?: string} = {}
): Promise<ExcalidrawSceneData> {
  const trimmed = mermaidCode.trim();
  if (!trimmed) throw new Error("Mermaid code is empty");

  const parseMermaidToExcalidraw = await loadParseMermaidToExcalidraw();
  const parseResult = await parseMermaidToExcalidraw(trimmed, {
    themeVariables: {
      fontSize: "16px",
      ...resolveThemeVars(Boolean(options.isDark)),
    },
  } as any);

  const sanitized = await sanitizeExcalidrawElements(parseResult.elements as any[], {
    isDark: Boolean(options.isDark),
    preferredStrokeColor: options.preferredStrokeColor,
    mode: "mermaid",  // 使用 Mermaid 轻量清洗模式
  });

  const normalized = ensureElementIds(sanitized as any[]);
  return {
    elements: normalized as ExcalidrawElement[],
    files: parseResult.files,
  };
}

export async function generateDslEdit(
  currentElements: ExcalidrawElement[],
  editPrompt: string
): Promise<DslEditResult> {
  const trimmedPrompt = editPrompt.trim();
  if (!trimmedPrompt) throw new Error("Prompt is empty");

  const snapshot = convertJsonToDsl(currentElements);
  const {idMap, nextNewId} = calculateIdMapping(currentElements, snapshot.document.idMap || {});

  const {provider} = await resolveTextProvider();
  const result = await text_generation(provider, {
    prompt: buildDslEditPrompt(snapshot.dsl, trimmedPrompt, idMap, nextNewId),
    temperature: 0.3,
  });

  const responseText = result.text || "";
  const dsl = extractDsl(responseText);
  return {dsl, document: snapshot.document};
}

export async function applyDslChanges(
  dsl: string,
  referenceDoc: DSLCompressedDocument,
  options: {isDark?: boolean; preferredStrokeColor?: string} = {}
): Promise<ExcalidrawElement[]> {
  const trimmed = dsl.trim();
  if (!trimmed) throw new Error("DSL is empty");

  const compiled = convertDslToJson(trimmed, referenceDoc);
  const sanitized = await sanitizeExcalidrawElements(compiled.elements as any[], {
    isDark: Boolean(options.isDark),
    preferredStrokeColor: options.preferredStrokeColor,
  });

  return ensureElementIds(sanitized as any[]) as ExcalidrawElement[];
}

/**
 * 使用 AI 修复格式错误的 JSON
 * @param brokenJson 需要修复的 JSON 字符串
 * @param options 配置选项
 * @returns 修复后的 JSON 字符串，如果无法修复则返回 null
 */
export async function repairJsonWithAI(
  brokenJson: string,
  options: {signal?: AbortSignal} = {}
): Promise<string | null> {
  const trimmed = brokenJson.trim();
  if (!trimmed) return null;

  try {
    const {provider} = await resolveTextProvider();
    const result = await text_generation(
      provider,
      {
        prompt: `请修复以下 JSON：\n${trimmed}`,
        systemPrompt: JSON_REPAIR_SYSTEM_PROMPT,
        temperature: 0.1,  // 低温度保证确定性
        maxTokens: 4096,
        stream: false,
        signal: options.signal,
      }
    );
    
    let repairedText = result.text.trim();
    
    // 移除可能的代码块标记
    if (repairedText.startsWith('```')) {
      repairedText = repairedText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
    
    // 验证修复结果
    try {
      JSON.parse(repairedText);
      return repairedText;
    } catch {
      console.warn('[Excalidraw] AI repair result is still invalid JSON:', repairedText.substring(0, 100));
      return null;
    }
  } catch (error) {
    console.error('[Excalidraw] AI repair failed:', error);
    return null;
  }
}
