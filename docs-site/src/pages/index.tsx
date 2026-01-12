import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs">
            📚 快速开始
          </Link>
          <Link
            className="button button--primary button--lg"
            href="https://agnx-excalidraw.vercel.app/">
            🚀 在线演示
          </Link>
          <Link
            className="button button--outline button--lg"
            href="https://github.com/duo121/agnx-excalidraw">
            ⭐ GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  description: string;
  emoji: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'AI 驱动',
    emoji: '🤖',
    description: '支持多种 AI 模型，通过自然语言描述生成图表，让绘图更智能。',
  },
  {
    title: 'Mermaid 支持',
    emoji: '📊',
    description: '自动将 Mermaid 代码转换为手绘风格的 Excalidraw 图形。',
  },
  {
    title: 'DSL 编辑',
    emoji: '📝',
    description: '通过 DSL 语法高效编辑画布元素，支持批量操作。',
  },
  {
    title: '一键部署',
    emoji: '🚀',
    description: '支持 Vercel 一键部署，快速上线你的白板应用。',
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className="text--center" style={{fontSize: '3rem'}}>
        {emoji}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - AI 增强白板`}
      description="AI-powered Excalidraw whiteboard with Mermaid support and DSL editing">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
