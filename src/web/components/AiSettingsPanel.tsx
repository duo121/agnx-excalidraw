import React, {useEffect, useMemo, useState} from "react";
import {Eye, EyeOff} from "lucide-react";
import {nanoid} from "nanoid";
import type {ModelProvider, AppConfig} from "../../sdk/ai/types";
import {listProviderDefinitions} from "../../sdk/ai/text_generation";

import {buildConfigWithActiveProvider, loadAppConfig, persistAppConfig, resolveActiveProvider} from "../../sdk/ai/config";

const emptyConfig: AppConfig = {
  models: [],
  activeModel: null,
};

const isEnvProvider = (provider: ModelProvider): boolean => {
  return typeof provider.id === "string" && provider.id.startsWith("env_");
};

const normalizeModels = (value: string) => {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

type AiSettingsPanelProps = {
  onClose?: () => void;
};

export const AiSettingsPanel: React.FC<AiSettingsPanelProps> = ({onClose}) => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [revealKeys, setRevealKeys] = useState<Record<string, boolean>>({});

  const providerDefinitions = useMemo(() => listProviderDefinitions(), []);

  const definitionByType = useMemo(() => new Map(providerDefinitions.map((def) => [def.id, def])), [providerDefinitions]);

  useEffect(() => {
    const load = async () => {
      const config = await loadAppConfig();
      const active = resolveActiveProvider(config);
      const normalizedProviders = (config.models || []).map((provider) => {
        const def = (provider.type && definitionByType.get(provider.type)) || null;
        return {
          ...provider,
          name: provider.name || def?.name || provider.id,
        };
      }).filter((provider) => !isEnvProvider(provider));
      setProviders(normalizedProviders);
      if (active) {
        setActiveProviderId(active.provider.id);
        setActiveModel(active.model || active.provider.models?.[0] || null);
      } else if (config.models?.length) {
        setActiveProviderId(config.models[0].id);
        setActiveModel(config.models[0].models?.[0] || null);
      }
    };

    load().catch(() => {
      setProviders(emptyConfig.models || []);
      setActiveProviderId(null);
      setActiveModel(null);
    });
  }, []);

  const updateProvider = (index: number, patch: Partial<ModelProvider>) => {
    setProviders((prev) =>
      prev.map((provider, idx) => (idx === index ? {...provider, ...patch} : provider))
    );
  };

  const handleAddProvider = () => {
    const defaultDef = providerDefinitions[0];
    const nextProvider: ModelProvider = {
      id: `provider_${nanoid(6)}`,
      name: defaultDef?.name || "Provider",
      type: defaultDef?.id || "openai",
      apiKey: "",
      baseUrl: defaultDef?.baseUrl,
      models: defaultDef?.models || ["gpt-4o-mini"],
      enabled: false,
    };
    setProviders((prev) => [...prev, nextProvider]);
    if (!activeProviderId) {
      setActiveProviderId(nextProvider.id);
      setActiveModel(nextProvider.models?.[0] || null);
    }
  };

  const handleRemoveProvider = (id: string) => {
    const nextProviders = providers.filter((provider) => provider.id !== id);
    setProviders(nextProviders);
    if (activeProviderId === id) {
      const nextProvider = nextProviders[0] || null;
      setActiveProviderId(nextProvider?.id || null);
      setActiveModel(nextProvider?.models?.[0] || null);
    }
  };

  const handleActivate = (provider: ModelProvider) => {
    setActiveProviderId(provider.id);
    setActiveModel((current) => current || provider.models?.[0] || null);
  };

  const toggleRevealKey = (providerId: string) => {
    setRevealKeys((prev) => ({...prev, [providerId]: !prev[providerId]}));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    const normalizedProviders = providers.map((provider) => ({
      ...provider,
      models: provider.models?.length ? provider.models : undefined,
      baseUrl: provider.baseUrl || undefined,
      name: provider.name || provider.id,
    }));

    const nextConfig = buildConfigWithActiveProvider(
      normalizedProviders,
      activeProviderId,
      activeModel
    );

    try {
      await persistAppConfig(nextConfig);
      setSaveMessage("Saved");
      if (onClose) {
        setTimeout(onClose, 800);
      }
    } catch (error) {
      setSaveMessage("Save failed");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 1200);
    }
  };

  const inputClassName =
    "w-full rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs text-slate-800 outline-none transition shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:focus:border-sky-400/40 dark:focus:ring-sky-500/20";

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 text-sm text-slate-700 dark:text-slate-200">
      {/* 免费模型提示 */}
      <a
        href="https://platform.iflow.cn/profile?tab=apiKey"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-emerald-300/50 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-3 text-xs transition hover:border-emerald-400/70 hover:shadow-md dark:border-emerald-500/30 dark:from-emerald-900/30 dark:to-teal-900/30 dark:hover:border-emerald-400/50"
      >
        <span className="text-xl">🎁</span>
        <div className="flex-1">
          <div className="font-medium text-emerald-800 dark:text-emerald-200">
            免费 API Key 可用
          </div>
          <div className="text-emerald-600/80 dark:text-emerald-400/80">
            支持 GLM-4-Air、Kimi K2 等模型，点击获取
          </div>
        </div>
        <span className="text-emerald-500">→</span>
      </a>

      <div className="flex flex-col gap-3">
        {providers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
            No providers configured. Add one to get started.
          </div>
        )}

        {providers.map((provider, index) => {
          const isActive = provider.id === activeProviderId;
          const definition = definitionByType.get(provider.type || "");
          const displayName = provider.name || definition?.name || provider.id;
          return (
            <div
              key={provider.id}
              className={`relative overflow-hidden rounded-3xl border p-4 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.45)] ${
                isActive
                  ? "border-sky-300/60 ring-2 ring-sky-300/30 dark:border-sky-400/30 dark:ring-sky-400/20"
                  : "border-slate-200/70 dark:border-white/10"
              } bg-white/85 dark:bg-slate-950/70`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[180px] flex-1">
                  <input
                    className={inputClassName}
                    value={displayName}
                    onChange={(event) => updateProvider(index, {name: event.target.value})}
                    placeholder={definition?.name || "Provider name"}
                  />
                </div>
                <button
                  className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
                  type="button"
                  onClick={() => handleRemoveProvider(provider.id)}
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="min-w-[90px]">Type</span>
                  <select
                    className={`${inputClassName} flex-1`}
                    value={provider.type || ""}
                    onChange={(event) => {
                      const type = event.target.value;
                      const nextDef = definitionByType.get(type);
                      if (provider.id === activeProviderId && nextDef?.models?.length) {
                        setActiveModel(nextDef.models[0]);
                      }
                      updateProvider(index, {
                        type,
                        baseUrl: nextDef?.baseUrl || provider.baseUrl,
                        models: nextDef?.models?.length ? nextDef.models : provider.models,
                        name: nextDef?.name || provider.name || type,
                      });
                    }}
                  >
                    {providerDefinitions.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="min-w-[90px]">Base URL</span>
                  <input
                    className={`${inputClassName} flex-1`}
                    value={provider.baseUrl || ""}
                    onChange={(event) => updateProvider(index, {baseUrl: event.target.value})}
                    placeholder={definition?.baseUrl || "https://api.openai.com/v1"}
                  />
                </label>

                <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="min-w-[90px]">API Key</span>
                  <div className="relative flex-1">
                    <input
                      className={`${inputClassName} pr-9 w-full`}
                      type={revealKeys[provider.id] ? "text" : "password"}
                      value={provider.apiKey || ""}
                      onChange={(event) => updateProvider(index, {apiKey: event.target.value})}
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => toggleRevealKey(provider.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                      aria-label={revealKeys[provider.id] ? "Hide API key" : "Show API key"}
                    >
                      {revealKeys[provider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </label>

                <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="min-w-[90px]">Models</span>
                  <input
                    className={`${inputClassName} flex-1`}
                    value={(provider.models || []).join(", ")}
                    onChange={(event) => updateProvider(index, {models: normalizeModels(event.target.value)})}
                    placeholder={(definition?.models || ["gpt-4o-mini"]).join(", ")}
                  />
                </label>
              </div>

              <div className="mt-4 flex w-full flex-nowrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => handleActivate(provider)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-sky-600 text-white shadow-[0_12px_30px_-20px_rgba(14,165,233,0.7)] hover:bg-sky-500"
                      : "border border-slate-200/70 bg-white/70 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:border-white/25 dark:hover:bg-slate-800/70"
                  }`}
                  aria-pressed={isActive}
                >
                  {isActive ? "Active" : "Set active"}
                </button>

                {isActive && (
                  <label className="flex flex-1 items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <select
                      className={`${inputClassName} flex-1`}
                      value={activeModel || provider.models?.[0] || ""}
                      onChange={(event) => setActiveModel(event.target.value)}
                    >
                      {(provider.models || []).map((model) => (
                        <option key={model} value={model}>
                          {provider.name}/{model}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
          type="button"
          onClick={handleAddProvider}
        >
          Add provider
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.6)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        {saveMessage && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
};
