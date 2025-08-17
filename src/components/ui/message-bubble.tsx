"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LoadingDots } from "@/components/ui/loading-dots";
import { ThinkCard } from "@/components/ui/think-card";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useTranslations } from '@/i18n/hooks';

interface MessageBubbleProps {
  role: "user" | "ai";
  content: string;
  isLoading?: boolean;
  hasRelatedDocs?: boolean;
  onShowRelatedDocs?: () => void;
  relatedDocsCount?: number; // Add related document count attribute
}

interface ThinkBlock {
  content: string;
  time: number;
  position: number;
  fullMatch: string;
  isComplete: boolean;
}

/**
 * Message bubble component, used to display messages in conversations
 * Supports user and AI messages, as well as special processing of AI thinking content
 */
export function MessageBubble({
  role,
  content,
  isLoading = false,
  hasRelatedDocs = false,
  onShowRelatedDocs,
  relatedDocsCount = 0, // Default to 0
}: MessageBubbleProps) {
  const { t } = useTranslations();
  const isUser = role === "user";
  // Check if it is a single line (no line breaks and short length)
  const isSingleLine = !content.includes("\n") && content.length < 40;
  // AI avatar offset is equal to py-3 (about 0.75rem*2=1.5rem=24px), but the actual offset is reduced to 12px more naturally
  const aiAvatarOffset = isUser ? 0 : 12;
  
  // Check if it is an AI message with empty content (loading state)
  const isEmptyAiMessage = !isUser && !content && isLoading;
  
  // Store processed content and think blocks
  const [processedContent, setProcessedContent] = useState("");
  const [thinkBlocks, setThinkBlocks] = useState<ThinkBlock[]>([]);
  const [pendingThinkContent, setPendingThinkContent] = useState("");
  const [pendingThinkStart, setPendingThinkStart] = useState(-1);
  
  // Real-time processing of content, listening to <think> tags
  useEffect(() => {
    if (isUser || !content) {
      setProcessedContent(content);
      return;
    }
    
    // Find all completed <think> tags
    const completeThinkRegex = /<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)<\/think>/g;
    const completeMatches = [...content.matchAll(completeThinkRegex)];
    
    // Create completed think blocks
    const completeBlocks = completeMatches.map(match => ({
      content: match[2].trim(),
      time: match[1] ? parseInt(match[1], 10) : 22,
      position: match.index || 0,
      fullMatch: match[0],
      isComplete: true
    }));
    
    // Find incomplete <think> tags (start tag but no end tag)
    let remainingContent = content;
    let pendingStart = -1;
    let pendingContent = "";
    
    // Remove all completed <think> tags
    completeMatches.forEach(match => {
      remainingContent = remainingContent.replace(match[0], '');
    });
    
    // Find incomplete <think> tags
    const openTagMatch = remainingContent.match(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*)$/);
    if (openTagMatch) {
      pendingStart = content.indexOf(openTagMatch[0]);
      pendingContent = openTagMatch[2] || "";
    }
    
    // Update status
    setPendingThinkStart(pendingStart);
    setPendingThinkContent(pendingContent);
    
    // Process main content (remove all <think> tags)
    let mainContent = content;
    
    // Remove completed <think> tags
    completeMatches.forEach(match => {
      mainContent = mainContent.replace(match[0], '');
    });
    
    // Remove incomplete <think> tags
    if (pendingStart >= 0) {
      mainContent = mainContent.substring(0, pendingStart);
    }
    
    // Clean content
    mainContent = mainContent.replace(/\n{3,}/g, '\n\n').trim();
    
    // Update status
    setProcessedContent(mainContent);
    setThinkBlocks(completeBlocks);
  }, [content, isUser]);
  
  // Merge all think blocks, including incomplete ones
  const allThinkBlocks = useMemo(() => {
    if (pendingThinkStart >= 0 && pendingThinkContent) {
      return [
        ...thinkBlocks,
        {
          content: pendingThinkContent,
          time: 0,
          position: pendingThinkStart,
          fullMatch: `<think>${pendingThinkContent}`,
          isComplete: false
        }
      ];
    }
    return thinkBlocks;
  }, [thinkBlocks, pendingThinkContent, pendingThinkStart]);
  
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 w-full`}>
      {!isUser && (
        <div className="flex" style={{ alignItems: isEmptyAiMessage ? "center" : isUser ? "center" : "flex-start" }}>
          <Avatar
            className="mr-2"
            style={{ marginTop: isEmptyAiMessage ? 0 : isUser ? 0 : aiAvatarOffset }}
          >
            <AvatarFallback className="bg-black text-white">AI</AvatarFallback>
          </Avatar>
        </div>
      )}
      <div
        className={`rounded-lg py-3 text-sm ${
          isUser
            ? "bg-black text-white rounded-br-none max-w-xl px-4 whitespace-pre-line"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none flex-1 pl-4 pr-2"
        }`}
        style={{ 
          alignSelf: (isUser && isSingleLine) || isEmptyAiMessage ? "center" : "flex-start",
          minHeight: isEmptyAiMessage ? "36px" : "auto", // Ensure empty messages also have a certain height
          display: "flex",
          flexDirection: "column",
          alignItems: isEmptyAiMessage ? "flex-start" : "flex-start",
          width: isUser ? "auto" : "100%" // User message adapts to content, AI message fills width
        }}
      >
        {/* User message displays content directly */}
        {isUser ? (
          content
        ) : (
          <>
            {/* 1. Related documents button - always placed at the top */}
            {hasRelatedDocs && (
              <div className="flex items-center mb-3">
                <button
                  className="flex items-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent border-0 p-0 cursor-pointer"
                  onClick={onShowRelatedDocs}
                  style={{ padding: 0, margin: 0, background: 'none', height: 'auto' }}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {t('pages.chat.foundDocuments', { count: relatedDocsCount })}
                </button>
              </div>
            )}
            
            {/* 2. Think blocks - displayed after the related documents button */}
            {allThinkBlocks.length > 0 && (
              <div className="w-full mb-2">
                {allThinkBlocks.map((block, index) => (
                  <ThinkCard 
                    key={index} 
                    content={block.content} 
                    thinkTime={block.time}
                    isComplete={block.isComplete}
                    defaultExpanded={true}
                  />
                ))}
              </div>
            )}
            
            {/* 3. Main content - displayed last */}
            {(allThinkBlocks.length > 0 && processedContent) ? (
              <div className="mt-1 w-full">
                <MarkdownRenderer content={processedContent} />
              </div>
            ) : (
              allThinkBlocks.length === 0 && (
                <div className="w-full">
                  <MarkdownRenderer content={content} />
                </div>
              )
            )}
            
            {/* 4. Loading indicator */}
            {isLoading && (
              <div className={isEmptyAiMessage ? 'flex items-center justify-start w-full' : 'flex items-center mt-2 w-full'}>
                <LoadingDots />
              </div>
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="flex" style={{ alignItems: isSingleLine ? "center" : "flex-start" }}>
          <Avatar className="ml-2 mt-0">
            <AvatarFallback className="bg-gray-400 text-white">ME</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
} 