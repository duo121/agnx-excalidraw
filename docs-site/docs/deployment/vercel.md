---
sidebar_position: 1
---

# 部署到 Vercel

本指南介绍如何将 AGNX Excalidraw 部署到 Vercel。

## 一键部署

点击下方按钮快速部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/duo121/agnx-excalidraw)

## 手动部署步骤

### 1. Fork 仓库

将 [agnx-excalidraw](https://github.com/duo121/agnx-excalidraw) fork 到你的 GitHub 账号。

### 2. 导入到 Vercel

1. 登录 [Vercel](https://vercel.com)
2. 点击 "Add New Project"
3. 选择 "Import Git Repository"
4. 选择你 fork 的仓库

### 3. 配置项目

Vercel 会自动检测项目配置。确认以下设置：

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Vite |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Install Command | `pnpm install` |

### 4. 配置环境变量

在 Vercel 控制台的 Settings → Environment Variables 中添加：

```
OPENAI_API_KEY=your_api_key
```

:::warning 安全提示
不要在 Vercel 环境变量中使用 `VITE_` 前缀的 API Key，这会导致密钥暴露到客户端。

生产环境建议使用后端代理处理 AI API 调用。
:::

### 5. 部署

点击 "Deploy" 按钮开始部署。

## 项目配置文件

项目已包含 `vercel.json` 配置：

```json
{
  "framework": "vite",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist"
}
```

## 自定义域名

1. 进入项目 Settings → Domains
2. 添加你的自定义域名
3. 按提示配置 DNS 记录

## 部署文档站点

文档站点（Docusaurus）需要单独部署：

```bash
cd docs-site
pnpm build
```

可以选择：
- 部署到 Vercel 的另一个项目
- 使用 GitHub Pages
- 使用 Netlify

## 常见问题

### 构建失败

检查以下几点：
- Node.js 版本是否 >= 18
- 是否正确安装了 pnpm
- 依赖是否完整

### 环境变量未生效

- 确保环境变量已正确配置
- 重新部署项目（Redeploy）
- 检查变量名是否正确

### 生产环境 AI 功能不工作

生产环境不会注入 API Key，需要配置后端代理或在客户端让用户输入 API Key。
