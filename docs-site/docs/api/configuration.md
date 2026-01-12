---
sidebar_position: 4
---

# 配置 API

配置管理模块提供 AI Provider 配置的加载和保存功能。

## loadAppConfig

加载应用配置。

```typescript
async function loadAppConfig(): Promise<AppConfig>
```

## persistAppConfig

保存应用配置。

```typescript
async function persistAppConfig(config: AppConfig): Promise<void>
```

## resolveActiveProvider

获取当前激活的 Provider。

```typescript
function resolveActiveProvider(config: AppConfig): ActiveProvider | null
```

## isConfigReady

检查配置是否就绪（有可用的 Provider 和 API Key）。

```typescript
function isConfigReady(config: AppConfig): boolean
```

## buildConfigWithActiveProvider

构建带有激活 Provider 的配置。

```typescript
function buildConfigWithActiveProvider(
  providers: ModelProvider[],
  activeProviderId: string | null,
  activeModel: string | null
): AppConfig
```

## 类型定义

```typescript
type AppConfig = {
  models: ModelProvider[];
  activeModel: {
    providerId: string;
    model: string;
  } | null;
};

type ModelProvider = {
  id: string;
  name: string;
  type?: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  enabled?: boolean;
};

type ActiveProvider = {
  provider: ModelProvider;
  model?: string;
};
```
