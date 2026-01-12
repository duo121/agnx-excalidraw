const STORAGE_PREFIX = "excalidraw:";

export const storageKeys = {
  aiConfig: `${STORAGE_PREFIX}ai-config`,
  envApiKeys: `${STORAGE_PREFIX}env-apikeys`,
  aiToolbarPosition: `${STORAGE_PREFIX}ai-toolbar-position`,
  aiDialogPosition: `${STORAGE_PREFIX}ai-dialog-position`,
  aiDialogSize: `${STORAGE_PREFIX}ai-dialog-size`,
  lastDiagramId: `${STORAGE_PREFIX}last-diagram-id`,
  diagram: (id: string) => `${STORAGE_PREFIX}diagram:${id}`,
  aiChatHistory: (diagramId: string) => `${STORAGE_PREFIX}ai-chat-history:${diagramId}`,
};

export const legacyStorageKeys = {
  lastDiagramId: "agn:last-excalidraw-diagram-id",
  aiChatHistory: (diagramId: string) => `excalidraw-ai-chat-history:${diagramId}`,
};

const hasStorage = (): boolean => {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
};

const safeGetItem = (key: string): string | null => {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore write failures
  }
};

const safeRemoveItem = (key: string): void => {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore remove failures
  }
};

const parseJson = <T>(raw: string): {ok: boolean; value?: T} => {
  try {
    return {ok: true, value: JSON.parse(raw) as T};
  } catch {
    return {ok: false};
  }
};

export const readJson = <T>(key: string, fallback: T): T => {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  const parsed = parseJson<T>(raw);
  return parsed.ok ? (parsed.value as T) : fallback;
};

export const readJsonWithFallback = <T>(
  key: string,
  fallbackKeys: string[],
  fallback: T
): T => {
  const raw = safeGetItem(key);
  if (raw) {
    const parsed = parseJson<T>(raw);
    if (parsed.ok) {
      return parsed.value as T;
    }
  }

  for (const fallbackKey of fallbackKeys) {
    const fallbackRaw = safeGetItem(fallbackKey);
    if (!fallbackRaw) continue;
    const parsed = parseJson<T>(fallbackRaw);
    if (parsed.ok) {
      safeSetItem(key, JSON.stringify(parsed.value));
      return parsed.value as T;
    }
  }

  return fallback;
};

export const writeJson = (key: string, value: unknown): void => {
  safeSetItem(key, JSON.stringify(value));
};

export const readStringWithFallback = (
  key: string,
  fallbackKeys: string[],
  fallback: string | null = null
): string | null => {
  const value = safeGetItem(key);
  if (value !== null) return value;

  for (const fallbackKey of fallbackKeys) {
    const fallbackValue = safeGetItem(fallbackKey);
    if (fallbackValue !== null) {
      safeSetItem(key, fallbackValue);
      return fallbackValue;
    }
  }

  return fallback;
};

export const writeString = (key: string, value: string): void => {
  safeSetItem(key, value);
};

export const removeItem = (key: string): void => {
  safeRemoveItem(key);
};
