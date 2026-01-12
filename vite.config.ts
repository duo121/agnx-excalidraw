import {defineConfig, loadEnv} from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// 项目根目录（独立项目，不再依赖 monorepo）
const projectRoot = __dirname;
const catalogPath = path.resolve(__dirname, "src/sdk/ai/text_generation.json");

const readProviderPrefixes = (): string[] => {
  try {
    const raw = fs.readFileSync(catalogPath, "utf-8");
    const catalog = JSON.parse(raw) as {providers?: Array<{id: string}>};
    const ids = catalog.providers?.map((p) => p.id).filter(Boolean) ?? [];
    return ids.map((id) => `${id.toUpperCase()}_`);
  } catch {
    return [];
  }
};

const readEnvApiKeyPrefixes = (): string[] => {
  const prefixes = new Set<string>();
  for (const key of Object.keys(process.env)) {
    if (/_API_KEY$/i.test(key)) {
      const prefix = key.replace(/_API_KEY$/i, "_");
      prefixes.add(prefix);
    }
  }
  return Array.from(prefixes);
};

const readEnvApiKeyPrefixesFromFiles = (mode: string): string[] => {
  const prefixes = new Set<string>();
  const candidates = [
    ".env",
    `.env.${mode}`,
    `.env.${mode}.local`,
    ".env.local",
  ];
  for (const file of candidates) {
    const filePath = path.resolve(projectRoot, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=/);
      if (!match) continue;
      const key = match[1];
      if (/_API_KEY$/i.test(key)) {
        prefixes.add(key.replace(/_API_KEY$/i, "_"));
      }
    }
  }
  return Array.from(prefixes);
};

export default defineConfig(({mode}) => {
  const envAll = loadEnv(mode, projectRoot, "");
  const basePrefixes = ["VITE_", "BASE_URL", "API_KEY", "MODEL"];
  const providerPrefixes = readProviderPrefixes();
  // 仅在非生产模式注入所有 *_API_KEY，避免生产构建泄露密钥
  const dynamicApiKeyPrefixes =
    mode === "production"
      ? []
      : [
          ...readEnvApiKeyPrefixes(),
          ...readEnvApiKeyPrefixesFromFiles(mode),
        ];
  const envPrefix = Array.from(new Set([...basePrefixes, ...providerPrefixes, ...dynamicApiKeyPrefixes]));

  const devApiKeyMap: Record<string, string> = {};
  if (mode !== "production") {
    for (const [key, value] of Object.entries(envAll)) {
      if (typeof value === "string" && /_API_KEY$/i.test(key)) {
        devApiKeyMap[key] = value;
      }
    }
  }

  return {
    envDir: projectRoot,
    envPrefix,
    define: {
      __EXCALIDRAW_DEV_API_KEYS__: JSON.stringify(devApiKeyMap),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@web": path.resolve(__dirname, "src/web"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      fs: {
        allow: [projectRoot],
      },
      watch: {
        include: path.resolve(__dirname, "src") + "/**",
        followSymlinks: false,
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
