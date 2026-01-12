import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: '入门指南',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: '核心概念',
      items: [
        'concepts/architecture',
        'concepts/sdk-vs-web',
        'concepts/ai-integration',
        'concepts/mermaid-support',
        'concepts/dsl-editing',
      ],
    },
    {
      type: 'category',
      label: 'API 参考',
      items: [
        'api/overview',
        'api/ai-client',
        'api/dsl-converter',
        'api/configuration',
      ],
    },
    {
      type: 'category',
      label: '部署',
      items: [
        'deployment/vercel',
        'deployment/docker',
        'deployment/self-hosted',
      ],
    },
    {
      type: 'category',
      label: '贡献指南',
      items: [
        'contributing/how-to-contribute',
        'contributing/development-setup',
        'contributing/code-style',
      ],
    },
  ],
};

export default sidebars;
