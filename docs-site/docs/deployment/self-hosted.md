---
sidebar_position: 3
---

# 自托管部署

在自己的服务器上部署 AGNX Excalidraw。

## 静态文件部署

### 1. 构建项目

```bash
pnpm build
```

### 2. 上传文件

将 `dist` 目录下的所有文件上传到你的 Web 服务器。

### 3. 配置 Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/excalidraw;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 使用 PM2

```bash
# 安装 serve
npm install -g serve

# 使用 PM2 运行
pm2 start serve --name excalidraw -- -s dist -l 3000
```
