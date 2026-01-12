import type {AppConfig, ModelProvider} from "./types";
import {getAppConfig, saveAppConfig} from "./storage";
import {readJson, storageKeys, writeJson} from "../../storage";
import {findProviderDefinition, listProviderDefinitions} from "./text_generation";

declare const __EXCALIDRAW_DEV_API_KEYS__: Record<string, string> | undefined;

const maskApiKey = (value: unknown): string => {
  if (typeof value !== "string") return String(value ?? "");
  const trimmed = value.trim();
  if (!trimmed) return "(empty)";
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}...(${trimmed.length})`;
};

export type ActiveProvider = {
  provider: ModelProvider;
  model?: string;
};

const resolveProviderModel = (provider: ModelProvider, preferredModel: string | null): string | undefined => {
  const models = provider.models || [];
  if (!models.length) return preferredModel || undefined;
  if (preferredModel && models.includes(preferredModel)) {
    return preferredModel;
  }
  return models[0];
};

type EnvApiKeyMap = Record<string, string>;

const normalizeEnvApiKeys = (value: unknown): EnvApiKeyMap => {
  if (!value || typeof value !== "object") return {};
  const result: EnvApiKeyMap = {};
  for (const [key, apiKey] of Object.entries(value as Record<string, unknown>)) {
    if (typeof apiKey === "string" && apiKey.trim()) {
      result[key] = apiKey.trim();
    }
  }
  return result;
};

const readEnvApiKeysFromStorage = (): EnvApiKeyMap => {
  return normalizeEnvApiKeys(readJson<EnvApiKeyMap>(storageKeys.envApiKeys, {}));
};

const writeEnvApiKeysToStorage = (next: EnvApiKeyMap): void => {
  writeJson(storageKeys.envApiKeys, next);
};

const areEnvApiKeysEqual = (left: EnvApiKeyMap, right: EnvApiKeyMap): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

export const resolveProviderApiKey = (provider: ModelProvider): string => {
  const envApiKeys = readEnvApiKeysFromStorage();
  const lookupId = provider.type || provider.id;
  return provider.apiKey || envApiKeys[lookupId] || "";
};

const deriveApiKeyEnvName = (providerId: string): string => {
  return `${providerId.toUpperCase()}_API_KEY`;
};

const deriveViteApiKeyEnvName = (providerId: string): string => {
  return `VITE_${deriveApiKeyEnvName(providerId)}`;
};

export async function loadAppConfig(): Promise<AppConfig> {
  syncDevEnvApiKeys();
  const config = await getAppConfig();
  return applyEnvDefaults(config);
}

export async function persistAppConfig(next: AppConfig): Promise<void> {
  await saveAppConfig(next);
}

export function resolveActiveProvider(config: AppConfig): ActiveProvider | null {
  const providers = config.models || [];
  const preferred = config.activeModel || null;
  const preferredProviderId = preferred?.providerId || null;
  const preferredModel = preferred?.model || null;

  if (preferredProviderId) {
    const provider = providers.find((p) => p.id === preferredProviderId);
    if (provider) {
      return {provider, model: resolveProviderModel(provider, preferredModel)};
    }
  }

  const enabledProvider = providers.find((p) => p.enabled !== false);
  if (!enabledProvider) return null;
  return {provider: enabledProvider, model: resolveProviderModel(enabledProvider, preferredModel)};
}

export function isConfigReady(config: AppConfig): boolean {
  const active = resolveActiveProvider(config);
  if (!active?.provider) return false;
  if (!resolveProviderApiKey(active.provider)) return false;
  const models = active.provider.models || [];
  if (!models.length) return false;
  return true;
}

const ENV_PROVIDER_ID = "env-provider";

const getEnvContext = (): {env: Record<string, any>; isDev: boolean} => {
  const env = (import.meta as any)?.env ?? {};
  const devFlag = typeof env?.VITE_DEV_MODE === "string" ? env.VITE_DEV_MODE.toLowerCase() : "";
  const mode = typeof env?.MODE === "string" ? env.MODE.toLowerCase() : "";
  const isDev = Boolean(env?.DEV) || devFlag === "true" || devFlag === "1" || mode !== "production";
  return {env, isDev};
};

const pickEnvValue = (env: Record<string, any>, keys?: string[]): string => {
  if (!keys || keys.length === 0) return "";
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeModels = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const readEnvProvider = (): {provider: ModelProvider; activeModel: string | null} | null => {
  const {env, isDev} = getEnvContext();
  if (!env || !isDev) return null;

  const rawBaseUrl = env.VITE_BASE_URL || env.BASE_URL || "";
  const baseUrl = typeof rawBaseUrl === "string" && /^https?:\/\//.test(rawBaseUrl) ? rawBaseUrl : "";
  const apiKey = env.API_KEY || env.VITE_API_KEY || "";
  const modelValue = env.MODEL || env.VITE_MODEL || "";
  if (!apiKey && !baseUrl && !modelValue) return null;

  const models = normalizeModels(modelValue);
  const providerType = env.VITE_PROVIDER_TYPE || "openai";
  const definition = findProviderDefinition(providerType);
  const provider: ModelProvider = {
    id: ENV_PROVIDER_ID,
    name: env.VITE_PROVIDER_NAME || definition?.name || "Env Provider (dev)",
    type: providerType,
    apiKey,
    baseUrl: baseUrl || definition?.baseUrl || undefined,
    models: models.length ? models : definition?.models || ["gpt-4o-mini"],
    enabled: true,
  };

  return {provider, activeModel: provider.models?.[0] || null};
};

const collectDevEnvApiKeys = (): EnvApiKeyMap | null => {
  const {env, isDev} = getEnvContext();
  if (!env || !isDev) return null;

  const apiKeys: EnvApiKeyMap = {};
  const addApiKey = (id: string, key: string | undefined) => {
    if (!id || !key || apiKeys[id]) return;
    const value = key.trim();
    if (value) {
      apiKeys[id] = value;
    }
  };

  for (const definition of listProviderDefinitions()) {
    const envKey = deriveApiKeyEnvName(definition.id);
    const apiKey = pickEnvValue(env, [envKey, deriveViteApiKeyEnvName(definition.id)]);
    addApiKey(definition.id, apiKey);
  }

  for (const [envKey, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    const match = envKey.match(/^(?:VITE_)?([A-Z0-9_]+)_API_KEY$/);
    if (!match) continue;
    const providerId = match[1].toLowerCase();
    addApiKey(providerId, value);
  }

  const injectedApiKeys = typeof __EXCALIDRAW_DEV_API_KEYS__ === "object" ? __EXCALIDRAW_DEV_API_KEYS__ : {};
  for (const [envKey, value] of Object.entries(injectedApiKeys)) {
    const match = envKey.match(/^(?:VITE_)?([A-Z0-9_]+)_API_KEY$/);
    if (!match) continue;
    const providerId = match[1].toLowerCase();
    addApiKey(providerId, value);
  }

  return apiKeys;
};

const syncDevEnvApiKeys = (options: {force?: boolean} = {}): EnvApiKeyMap | null => {
  const apiKeys = collectDevEnvApiKeys();
  if (!apiKeys) return null;

  const stored = readEnvApiKeysFromStorage();
  if (options.force || !areEnvApiKeysEqual(stored, apiKeys)) {
    writeEnvApiKeysToStorage(apiKeys);
  }
  return apiKeys;
};

export const initDevEnvApiKeys = (): void => {
  syncDevEnvApiKeys({force: true});
};

const providerMatchesType = (provider: ModelProvider, type: string): boolean => {
  if (!type) return false;
  if (provider.type) return provider.type === type;
  return provider.id === type;
};

const mergeProviderWithEnvDefaults = (provider: ModelProvider, envProvider: ModelProvider): ModelProvider => {
  const models = provider.models?.length ? provider.models : envProvider.models;
  return {
    ...provider,
    type: provider.type || envProvider.type,
    name: provider.name || envProvider.name,
    baseUrl: provider.baseUrl || envProvider.baseUrl,
    models,
  };
};

const readEnvProviders = (): ModelProvider[] => {
  const apiKeys = collectDevEnvApiKeys();
  if (!apiKeys) return [];

  const providers: ModelProvider[] = [];
  for (const definition of listProviderDefinitions()) {
    const apiKey = apiKeys[definition.id];
    if (!apiKey) continue;
    providers.push({
      id: `env_${definition.id}`,
      name: definition.name,
      type: definition.id,
      apiKey,
      baseUrl: definition.baseUrl,
      models: definition.models,
      enabled: false,
    });
  }

  return providers;
};

const resolveEnvFallback = (
  providers: ModelProvider[],
  envProviders: ModelProvider[]
): {providerId: string; model: string} | null => {
  for (const envProvider of envProviders) {
    const provider = providers.find((item) => providerMatchesType(item, envProvider.type || ""));
    if (provider) {
      const model = provider.models?.[0] || envProvider.models?.[0];
      if (model) {
        return {providerId: provider.id, model};
      }
    }
  }
  return null;
};

const applyEnvDefaults = (config: AppConfig): AppConfig => {
  const envDefaults = readEnvProvider();
  const envProviders = readEnvProviders();
  if (!envDefaults && envProviders.length === 0) return config;

  const providers = config.models || [];
  const nextProviders = [...providers];

  if (envProviders.length > 0) {
    for (const envProvider of envProviders) {
      const index = nextProviders.findIndex((provider) => providerMatchesType(provider, envProvider.type || ""));
      if (index >= 0) {
        nextProviders[index] = mergeProviderWithEnvDefaults(nextProviders[index], envProvider);
      } else {
        nextProviders.push(envProvider);
      }
    }
  }

  if (envDefaults) {
    const envIndex = nextProviders.findIndex((provider) => provider.id === ENV_PROVIDER_ID);
    if (envIndex >= 0) {
      nextProviders[envIndex] = {...nextProviders[envIndex], ...envDefaults.provider, enabled: true};
    } else {
      nextProviders.unshift(envDefaults.provider);
    }
  }

  let nextConfig: AppConfig = {
    models: nextProviders,
    activeModel: config.activeModel ?? null,
  };

  const shouldForceEnv = Boolean(
    envDefaults && (envDefaults.provider.apiKey || envDefaults.activeModel || envDefaults.provider.baseUrl)
  );

  if (shouldForceEnv && envDefaults?.activeModel) {
    return {
      ...nextConfig,
      activeModel: {
        providerId: envDefaults.provider.id,
        model: envDefaults.activeModel,
      },
    };
  }

  if (!isConfigReady(nextConfig)) {
    const fallback = resolveEnvFallback(nextProviders, envProviders);
    if (fallback) {
      nextConfig = {
        ...nextConfig,
        activeModel: {
          providerId: fallback.providerId,
          model: fallback.model,
        },
      };
    }
  }

  return nextConfig;
};

export function buildConfigWithActiveProvider(
  providers: ModelProvider[],
  activeProviderId: string | null,
  activeModel: string | null
): AppConfig {
  const normalizedProviders = providers.map((provider) => ({
    ...provider,
    enabled: provider.id === activeProviderId,
  }));

  const activeProvider = normalizedProviders.find((provider) => provider.id === activeProviderId) || null;
  const resolvedModel = activeProvider ? resolveProviderModel(activeProvider, activeModel) : null;

  return {
    models: normalizedProviders,
    activeModel: activeProvider && resolvedModel
      ? {
          providerId: activeProvider.id,
          model: resolvedModel,
        }
      : null,
  };
}
