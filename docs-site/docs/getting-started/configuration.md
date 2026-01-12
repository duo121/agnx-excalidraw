---
sidebar_position: 3
---

# 配置指南

本指南介绍 AGNX Excalidraw 的各种配置选项。

## 环境变量

### AI Provider 配置

支持多种 AI 服务提供商：

| 环境变量 | 提供商 | 默认模型 |
|----------|--------|----------|
| `OPENAI_API_KEY` | OpenAI | gpt-4o-mini |
| `ANTHROPIC_API_KEY` | Anthropic | claude-3-sonnet |
| `GEMINI_API_KEY` | Google Gemini | gemini-pro |
| `DEEPSEEK_API_KEY` | DeepSeek | deepseek-chat |

### 自定义配置

```env
# 指定默认 Provider 类型
VITE_PROVIDER_TYPE=openai

# 自定义 API 端点（用于代理或私有部署）
VITE_BASE_URL=https://your-proxy.com/v1

# 指定默认模型
VITE_MODEL=gpt-4o-mini

# Provider 名称（显示在 UI 中）
VITE_PROVIDER_NAME=My Custom Provider
```

## 运行时配置

### 在 UI 中配置

1. 点击 AI 面板中的设置图标
2. 添加或修改 Provider
3. 选择默认模型
4. 配置保存在本地存储中

### 配置文件

Provider 定义在 `src/sdk/ai/text_generation.json`：

```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "baseUrl": "https://api.anthropic.com/v1",
      "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]
    }
  ]
}
```

## Vite 配置

### 开发服务器

修改 `vite.config.ts`：

```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5173,       // 端口号
  },
});
```

### 构建配置

```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,  // 生成 sourcemap
  },
});
```

## 安全注意事项

:::warning 生产环境安全
在生产环境构建时，`*_API_KEY` 环境变量**不会**被注入到客户端代码中，以防止 API 密钥泄露。

生产环境请使用后端代理来处理 AI API 调用。
:::

### 开发环境 vs 生产环境

| 环境 | API Key 注入 | 适用场景 |
|------|-------------|---------|
| 开发 (`pnpm dev`) | ✅ 自动注入 | 本地开发测试 |
| 生产 (`pnpm build`) | ❌ 不注入 | 部署到公网 |

## 下一步

- [架构说明](/docs/concepts/architecture) - 了解项目架构
- [Vercel 部署](/docs/deployment/vercel) - 部署到 Vercel
