import React from 'react';

export const AppHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/90 dark:border-gray-800">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            AGNX Excalidraw
          </h1>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">
            AI-Powered
          </span>
        </div>
        
        <nav className="flex items-center gap-4">
          <a
            href="https://agnx-excalidraw-docs.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            📚 文档
          </a>
          <a
            href="https://github.com/duo121/agnx-excalidraw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            💻 GitHub
          </a>
          <a
            href="https://agnx-excalidraw-docs.vercel.app/docs/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            💬 联系我
          </a>
        </nav>
      </div>
    </header>
  );
};
