import type {ActiveModelSelection, AppConfig} from "./types";
import {readJson, storageKeys, writeJson} from "../../storage";

const defaultConfig: AppConfig = {
  models: [],
  activeModel: null,
};

const normalizeActiveModel = (value: AppConfig["activeModel"]): ActiveModelSelection | null => {
  if (!value) return null;
  if (typeof value.providerId !== "string" || typeof value.model !== "string") return null;
  if (!value.providerId.trim() || !value.model.trim()) return null;
  return {providerId: value.providerId, model: value.model};
};

const readConfig = (): AppConfig => {
  const parsed = readJson<AppConfig>(storageKeys.aiConfig, defaultConfig);
  return {
    models: parsed.models || [],
    activeModel: normalizeActiveModel(parsed.activeModel),
  };
};

const writeConfig = (next: AppConfig): void => {
  writeJson(storageKeys.aiConfig, {
    models: next.models || [],
    activeModel: normalizeActiveModel(next.activeModel),
  });
};

export async function getAppConfig(): Promise<AppConfig> {
  return readConfig();
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  writeConfig(config);
}

export async function resetAppConfig(): Promise<void> {
  writeConfig({...defaultConfig});
}
