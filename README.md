# AGNX Excalidraw

[English](./README.md) | [中文](./README.zh-CN.md)

An AI-enhanced whiteboard application based on [Excalidraw](https://excalidraw.com/), supporting Mermaid diagram conversion, DSL editing, and multiple AI model integrations.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/duo121/agnx-excalidraw)

## 🔗 Links

| Link | Description |
|------|-------------|
| 🌐 [Live Demo](https://agnx-excalidraw.vercel.app/) | Try AGNX Excalidraw now |
| 📚 [Documentation](https://agnx-excalidraw-docs.vercel.app/) | Detailed docs and API reference |
| 💻 [GitHub Repository](https://github.com/duo121/agnx-excalidraw) | Source code and issues |

## ✨ Features

- 🎨 **Excalidraw Canvas** - Full Excalidraw drawing capabilities
- 🤖 **AI Chat** - Support for multiple AI models (OpenAI, Anthropic, Gemini, etc.)
- 📊 **Mermaid Support** - Automatically convert Mermaid code to Excalidraw graphics
- 📝 **DSL Editing** - Efficiently edit canvas elements via DSL syntax
- 💾 **Local Storage** - Auto-save diagrams to browser local storage
- 🌙 **Dark Mode** - Light/dark theme switching
- 🚀 **One-Click Deploy** - Deploy to Vercel with one click

## 🚀 Quick Start

### Requirements

- Node.js >= 18.0.0
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/duo121/agnx-excalidraw.git
cd agnx-excalidraw

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env` or `.env.local` file in the project root:

```env
# AI model configuration (at least one required)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# Optional: Custom model configuration
VITE_PROVIDER_TYPE=openai
VITE_BASE_URL=https://api.openai.com/v1
VITE_MODEL=gpt-4o-mini
```

### Build & Deploy

```bash
# Build for production
pnpm build

# Preview build
pnpm preview
```

## 📚 Usage Guide

### AI Chat

1. Click the AI icon in the right toolbar to open the AI panel
2. Enter your request, e.g., "Draw a user login flowchart"
3. AI will generate Mermaid code and convert it to Excalidraw graphics

### Mermaid Mode

1. Select "Mermaid" mode in the AI panel
2. Enter or let AI generate Mermaid code
3. Click "Convert" to transform code into graphics

Supported Mermaid diagram types:
- Flowchart
- Sequence Diagram
- Class Diagram
- State Diagram
- ER Diagram
- Gantt Chart

### DSL Edit Mode

1. Select "DSL" mode in the AI panel
2. Enter edit instructions, e.g., "Change all rectangles to blue"
3. AI will parse instructions and update canvas elements

## 🔧 Configuration

### Supported AI Providers

| Provider | Environment Variable | Default Model |
|----------|---------------------|---------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-sonnet |
| Google Gemini | `GEMINI_API_KEY` | gemini-pro |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |

### Vite Environment Variables

- Environment variables with `VITE_` prefix are exposed to the client
- `*_API_KEY` variables are NOT injected in production builds (for security)

## 🚀 Deploy to Vercel

### One-Click Deploy

Click the button below to deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/duo121/agnx-excalidraw)

### Manual Deploy

1. Fork this repository to your GitHub account
2. Import the project in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy!

## 🛠️ Development

### Commands

```bash
pnpm dev        # Start dev server
pnpm typecheck  # Type checking
pnpm build      # Build for production
pnpm preview    # Preview build
```

### Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS
- **Canvas**: Excalidraw
- **Diagrams**: Mermaid
- **Routing**: React Router DOM

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for details.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Excalidraw](https://excalidraw.com/) - Excellent hand-drawn style whiteboard tool
- [Mermaid](https://mermaid.js.org/) - Text-based diagram generation tool
- [Vercel](https://vercel.com/) - Excellent deployment platform

## 📬 Contact

If you have any questions or suggestions, feel free to reach out:

- 🐛 Submit a [GitHub Issue](https://github.com/duo121/agnx-excalidraw/issues)
- 💬 Add me on WeChat

<img src="public/wechat.jpg" alt="WeChat QR Code" width="200" />
