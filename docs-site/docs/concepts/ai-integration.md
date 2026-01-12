---
sidebar_position: 2
---

# AI 集成

AGNX Excalidraw 支持多种 AI 服务提供商，本文档介绍 AI 功能的工作原理。

## 支持的 AI Provider

| Provider | 支持模型 | 特点 |
|----------|---------|------|
| OpenAI | GPT-4o, GPT-4o-mini | 稳定、响应快 |
| Anthropic | Claude 3 系列 | 长上下文、理解能力强 |
| Google Gemini | Gemini Pro | 多模态支持 |
| DeepSeek | DeepSeek Chat | 性价比高 |

## 工作原理

### 1. Provider 抽象层

SDK 提供统一的 Provider 接口，支持不同 AI 服务：

```typescript
interface TextGenerationProvider {
  id: string;        // Provider ID
  apiKey: string;    // API 密钥
  baseUrl?: string;  // API 端点
  model: string;     // 模型名称
}
```

### 2. 流式响应

AI 响应采用流式传输，提升用户体验：

```typescript
await streamMermaid("画一个流程图", {
  onChunk: (chunk) => {
    // 实时显示生成内容
    console.log(chunk);
  },
  onComplete: (text) => {
    // 生成完成
    const code = extractMermaid(text);
  },
});
```

### 3. Prompt 工程

针对不同任务优化了 Prompt 模板：

- **Mermaid 生成** - 引导 AI 输出标准 Mermaid 语法
- **DSL 编辑** - 提供当前画布状态，指导 AI 修改
- **JSON 修复** - 自动修复格式错误的 JSON

## 使用场景

### 场景一：生成流程图

```typescript
// 用户描述 → Mermaid 代码 → Excalidraw 图形
const { code } = await generateMermaid("用户登录流程");
const sceneData = await convertMermaidToExcalidraw(code);
```

### 场景二：编辑画布

```typescript
// 获取当前元素 → DSL 编辑 → 应用变更
const elements = excalidrawAPI.getSceneElements();
const { dsl, document } = await generateDslEdit(
  elements, 
  "将所有矩形改为蓝色"
);
const newElements = await applyDslChanges(dsl, document);
```

### 场景三：直接生成 JSON

```typescript
// 复杂场景下直接生成 Excalidraw JSON
await streamExcalidrawJson("画一个三层架构图", {
  onChunk: (chunk) => console.log(chunk),
  onComplete: (text) => {
    // 解析 JSON 并应用
  },
});
```

## 配置多个 Provider

### 方法一：环境变量

```env
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 方法二：UI 配置

1. 打开 AI 设置面板
2. 点击「添加 Provider」
3. 填写 API Key 和模型

### 方法三：代码配置

```typescript
const config = await loadAppConfig();
const newConfig = buildConfigWithActiveProvider(
  [...config.models, customProvider],
  customProvider.id,
  "gpt-4o-mini"
);
await persistAppConfig(newConfig);
```

## 最佳实践

### 1. 选择合适的模型

- **简单任务**：GPT-4o-mini, Gemini Pro
- **复杂任务**：GPT-4o, Claude 3 Opus
- **成本敏感**：DeepSeek Chat

### 2. 优化 Prompt

提供更多上下文可以获得更好的结果：

```
❌ "画个流程图"
✅ "画一个电商订单处理流程，包含：下单、支付、发货、确认收货"
```

### 3. 处理错误

```typescript
try {
  await generateMermaid(prompt);
} catch (error) {
  if (error.message.includes("API key")) {
    // 提示用户配置 API Key
  } else if (error.message.includes("rate limit")) {
    // 提示稍后重试
  }
}
```

## 安全考虑

:::warning
生产环境不要在客户端暴露 API Key，应使用后端代理。
:::

### 推荐架构

```
浏览器 → 你的后端 → AI API
        ↑
    API Key 存储在后端
```
