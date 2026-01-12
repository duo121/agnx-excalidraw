import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AGNX Excalidraw',
  tagline: 'AI-powered Excalidraw whiteboard with Mermaid support',
  favicon: 'img/favicon.ico',

  // Vercel 部署 URL（部署后替换为实际域名）
  url: 'https://agnx-excalidraw-docs.vercel.app',
  // Vercel 部署使用根路径
  baseUrl: '/',

  // GitHub Pages 部署配置
  organizationName: 'duo121', // GitHub 用户名
  projectName: 'agnx-excalidraw', // 仓库名

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/duo121/agnx-excalidraw/tree/main/docs-site/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl:
            'https://github.com/duo121/agnx-excalidraw/tree/main/docs-site/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    navbar: {
      title: 'AGNX Excalidraw',
      logo: {
        alt: 'AGNX Excalidraw Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '文档',
        },
        {to: '/blog', label: '博客', position: 'left'},
        {
          href: 'https://agnx-excalidraw.vercel.app/',
          label: '🚀 在线演示',
          position: 'right',
        },
        {
          href: 'https://github.com/duo121/agnx-excalidraw',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '快速开始',
              to: '/docs/intro',
            },
            {
              label: '架构说明',
              to: '/docs/concepts/architecture',
            },
            {
              label: 'API 文档',
              to: '/docs/api/overview',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/duo121/agnx-excalidraw/discussions',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/duo121/agnx-excalidraw/issues',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '🚀 在线演示',
              href: 'https://agnx-excalidraw.vercel.app/',
            },
            {
              label: '博客',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/duo121/agnx-excalidraw',
            },
          ],
        },
        {
          title: '联系我',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/duo121/agnx-excalidraw/issues',
            },
            {
              label: '微信交流',
              to: '/docs/contact',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AGNX Excalidraw. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
