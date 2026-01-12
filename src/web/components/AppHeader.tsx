import React from 'react';

export const AppHeader: React.FC = () => {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex gap-2">
      <a
        href="https://agnx-excalidraw-docs.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800/90 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors backdrop-blur-sm shadow-lg"
      >
        📚 文档
      </a>
      <a
        href="https://github.com/duo121/agnx-excalidraw"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800/90 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors backdrop-blur-sm shadow-lg"
      >
        ⭐ GitHub
      </a>
      <a
        href="https://agnx-excalidraw-docs.vercel.app/docs/contact"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800/90 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors backdrop-blur-sm shadow-lg"
      >
        💬 联系
      </a>
    </div>
  );
};
