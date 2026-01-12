---
sidebar_position: 1
---

# API 概览

AGNX Excalidraw SDK 提供了一套完整的 API，用于 AI 生成、DSL 转换和配置管理。

## 安装

SDK 已包含在项目中，直接导入即可：

```typescript
import {
  // AI 客户端
  streamMermaid,
  generateMermaid,
  streamDslEdit,
  generateDslEdit,
  convertMermaidToExcalidraw,
  applyDslChanges,
  
  // 配置管理
  loadAppConfig,
  persistAppConfig,
  resolveActiveProvider,
  isConfigReady,
  
  // DSL 转换
  convertJsonToDsl,
  convertDslToJson,
} from './src/sdk';
```

## 模块概览

### AI 客户端 (`ai/client.ts`)

| 函数 | 描述 |
|------|------|
| `streamMermaid()` | 流式生成 Mermaid 代码 |
| `generateMermaid()` | 非流式生成 Mermaid 代码 |
| `streamDslEdit()` | 流式 DSL 编辑 |
| `generateDslEdit()` | 非流式 DSL 编辑 |
| `convertMermaidToExcalidraw()` | Mermaid 转 Excalidraw |
| `applyDslChanges()` | 应用 DSL 变更 |

### 配置管理 (`ai/config.ts`)

| 函数 | 描述 |
|------|------|
| `loadAppConfig()` | 加载应用配置 |
| `persistAppConfig()` | 保存应用配置 |
| `resolveActiveProvider()` | 获取当前 Provider |
| `isConfigReady()` | 检查配置是否就绪 |

### DSL 转换 (`dsl/converter.ts`)

| 函数 | 描述 |
|------|------|
| `convertJsonToDsl()` | JSON 转 DSL |
| `convertDslToJson()` | DSL 转 JSON |

## 快速示例

### 生成流程图

```typescript
// 1. 生成 Mermaid 代码
const { code } = await generateMermaid("用户登录流程");

// 2. 转换为 Excalidraw 元素
const sceneData = await convertMermaidToExcalidraw(code);

// 3. 更新画布
excalidrawAPI.updateScene({
  elements: sceneData.elements,
});
```

### DSL 编辑

```typescript
// 1. 获取当前元素
const elements = excalidrawAPI.getSceneElements();

// 2. 生成编辑后的 DSL
const { dsl, document } = await generateDslEdit(
  elements,
  "将所有矩形改为蓝色背景"
);

// 3. 应用变更
const newElements = await applyDslChanges(dsl, document);

// 4. 更新画布
excalidrawAPI.updateScene({ elements: newElements });
```

## 类型定义

### StreamHandlers

```typescript
type StreamHandlers = {
  onChunk?: (delta: string) => void;
  onComplete?: (text: string) => void;
  onError?: (error: Error) => void;
};
```

### AppConfig

```typescript
type AppConfig = {
  models: ModelProvider[];
  activeModel: {
    providerId: string;
    model: string;
  } | null;
};
```

### ModelProvider

```typescript
type ModelProvider = {
  id: string;
  name: string;
  type?: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  enabled?: boolean;
};
```

## 详细文档

- [AI 客户端 API](/docs/api/ai-client)
- [DSL 转换 API](/docs/api/dsl-converter)
- [配置 API](/docs/api/configuration)
