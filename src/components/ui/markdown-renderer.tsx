"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Generic Markdown rendering component
 * Supports code highlighting, tables, links, etc.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Preprocess content, remove all <think> tags
  const processedContent = React.useMemo(() => {
    return content
      .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)<\/think>/g, '') // Remove completed <think> tags
      .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)$/g, ''); // Remove incomplete <think> tags
  }, [content]);
  
  // Markdown rendering component style
  const markdownStyles = {
    // Basic style
    p: 'mb-2',
    a: 'text-blue-500 hover:underline',
    h1: 'text-xl font-bold mt-4 mb-2',
    h2: 'text-lg font-bold mt-3 mb-2',
    h3: 'text-base font-bold mt-2 mb-1',
    h4: 'text-sm font-bold mt-2 mb-1',
    ul: 'list-disc ml-5 mb-2',
    ol: 'list-decimal ml-5 mb-2',
    li: 'mb-1',
    blockquote: 'border-l-4 border-gray-300 dark:border-gray-600 pl-2 py-1 italic',
    code: 'bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono',
    pre: 'bg-transparent p-0 my-2 overflow-hidden font-mono text-sm',
    table: 'border-collapse border border-gray-300 dark:border-gray-600 my-2',
    th: 'border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-200 dark:bg-gray-700',
    td: 'border border-gray-300 dark:border-gray-600 px-2 py-1',
    img: 'max-w-full h-auto my-2',
    hr: 'border-t border-gray-300 dark:border-gray-600 my-4',
  };
  
  // Create style class for Markdown component
  const markdownComponents = {
    p: ({node, ...props}: any) => <p className={markdownStyles.p} {...props} />,
    a: ({node, ...props}: any) => <a className={markdownStyles.a} target="_blank" rel="noopener noreferrer" {...props} />,
    h1: ({node, ...props}: any) => <h1 className={markdownStyles.h1} {...props} />,
    h2: ({node, ...props}: any) => <h2 className={markdownStyles.h2} {...props} />,
    h3: ({node, ...props}: any) => <h3 className={markdownStyles.h3} {...props} />,
    h4: ({node, ...props}: any) => <h4 className={markdownStyles.h4} {...props} />,
    ul: ({node, ...props}: any) => <ul className={markdownStyles.ul} {...props} />,
    ol: ({node, ...props}: any) => <ol className={markdownStyles.ol} {...props} />,
    li: ({node, ...props}: any) => <li className={markdownStyles.li} {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className={markdownStyles.blockquote} {...props} />,
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      return !inline && language ? (
        <div className="rounded-md overflow-hidden">
          <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-4 py-1 text-xs">
            <span>{language}</span>
          </div>
          <SyntaxHighlighter
            style={atomDark}
            language={language}
            PreTag="div"
            className="rounded-b-md"
            showLineNumbers
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={markdownStyles.code} {...props}>
          {children}
        </code>
      );
    },
    pre: ({node, ...props}: any) => <pre className={markdownStyles.pre} {...props} />,
    table: ({node, ...props}: any) => <table className={markdownStyles.table} {...props} />,
    th: ({node, ...props}: any) => <th className={markdownStyles.th} {...props} />,
    td: ({node, ...props}: any) => <td className={markdownStyles.td} {...props} />,
    img: ({node, ...props}: any) => <img className={markdownStyles.img} {...props} />,
    hr: ({node, ...props}: any) => <hr className={markdownStyles.hr} {...props} />,
    // Add processing of think tags, convert them to span to avoid React warnings
    think: ({node, ...props}: any) => <span style={{display: 'none'}} {...props} />,
  };

  return (
    <div className={className}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
} 