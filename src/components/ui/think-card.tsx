"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface ThinkCardProps {
  /**
   * Thinking content
   */
  content: string;
  /**
   * Card title, default is "Deep Thinking"
   */
  title?: string;
  /**
   * Thinking time (seconds), if provided, display
   */
  thinkTime?: number;
  /**
   * Whether the thinking content is complete (has end tag)
   */
  isComplete?: boolean;
  /**
   * Whether to expand by default, default is true
   */
  defaultExpanded?: boolean;
}

/**
 * Collapsible component for displaying AI thinking process
 * Process content with <think> tags, click button to display thinking content
 */
export function ThinkCard({ 
  content, 
  title = "深度思考", 
  thinkTime, 
  isComplete = true, 
  defaultExpanded = true 
}: ThinkCardProps) {
  // Initialize state to defaultExpanded value
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="my-1 w-full">
      {/* Button part */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleExpand}
        className={`flex items-center justify-between px-2 py-0.5 h-7 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-800 rounded-md text-gray-700 dark:text-gray-300 font-normal text-sm w-auto ${!isComplete ? 'animate-pulse' : ''}`}
      >
        <span className="flex items-center">
          <BrainCircuit size={14} className="mr-1 text-gray-500 dark:text-gray-400" />
          {title} {!isComplete && <span className="ml-1 text-gray-500 dark:text-gray-400">(思考中...)</span>}
        </span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>

      {/* Content part, only displayed when expanded */}
      {isExpanded && (
        <div className="mt-1 mb-2 px-4 py-4 bg-gray-100 dark:bg-gray-800/80 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-md text-sm text-gray-500 dark:text-gray-400">
          <MarkdownRenderer content={content} />
          {!isComplete && (
            <span className="inline-block ml-1 animate-pulse">▌</span>
          )}
        </div>
      )}
    </div>
  );
} 