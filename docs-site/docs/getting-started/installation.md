---
sidebar_position: 1
---

# 安装指南

本指南将帮助你在本地安装和运行 AGNX Excalidraw。

## 环境要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0（推荐）或 npm/yarn

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/agnx-excalidraw.git
cd agnx-excalidraw
```

### 2. 安装依赖

使用 pnpm（推荐）：

```bash
pnpm install
```

或使用 npm：

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
# AI Provider API Keys（至少配置一个）
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# 可选配置
VITE_PROVIDER_TYPE=openai
VITE_MODEL=gpt-4o-mini
```

### 4. 启动开发服务器

```bash
pnpm dev
```

服务器启动后，访问 `http://localhost:5173`。

## 验证安装

如果一切正常，你应该能看到 Excalidraw 画布界面，右侧有 AI 工具栏。

### 测试 AI 功能

1. 点击右侧 AI 图标
2. 输入 "画一个简单的流程图"
3. 如果 AI 正常响应并生成图形，说明安装成功

## 常见问题

### 依赖安装失败

如果遇到依赖安装问题，尝试：

```bash
# 清除缓存
pnpm store prune

# 删除 node_modules 并重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### API Key 无效

- 确保 API Key 正确且有效
- 检查 API Key 是否有足够的额度
- 确保环境变量文件名是 `.env.local` 而不是 `.env`

### 端口被占用

修改 Vite 配置或使用其他端口：

```bash
pnpm dev -- --port 3000
```

## 下一步

安装完成后，请阅读 [快速上手](/docs/getting-started/quick-start) 了解基本使用方法。
