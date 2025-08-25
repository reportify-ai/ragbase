"use client";

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Send, Loader2, Database, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

interface SearchInputCardProps {
  /**
   * Input box value
   */
  value: string;
  /**
   * Callback for input box value change
   */
  onChange: (value: string) => void;
  /**
   * Callback for submitting form
   */
  onSubmit: (e?: React.FormEvent) => void;
  /**
   * Whether it is in loading state
   */
  isLoading?: boolean;
  /**
   * Whether to disable input box
   */
  disabled?: boolean;
  /**
   * Placeholder text for input box
   */
  placeholder?: string;
  /**
   * Height of input box
   */
  inputHeight?: string;
  /**
   * Height of content area
   */
  contentHeight?: string;
  /**
   * Minimum height of input box
   */
  minHeight?: string;
  /**
   * Reference to input box
   */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /**
   * Knowledge base list
   */
  knowledgeBases?: KnowledgeBase[];
  /**
   * List of selected knowledge base names
   */
  selectedKbs?: string[];
  /**
   * Callback for switching knowledge base selection
   */
  onToggleKb?: (kbName: string) => void;
  /**
   * Whether knowledge base is loading
   */
  isLoadingKbs?: boolean;
  /**
   * Whether to display knowledge base selection
   */
  showKbSelector?: boolean;
  /**
   * Custom style class
   */
  className?: string;
  /**
   * Additional buttons or components, displayed on the left
   */
  leftActions?: React.ReactNode;
}

/**
 * Search input card component
 * Contains input box, knowledge base selection and send button
 */
export function SearchInputCard({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Enter your question...",
  inputHeight = "h-12",
  contentHeight,
  minHeight = "32px",
  inputRef,
  knowledgeBases = [],
  selectedKbs = [],
  onToggleKb,
  isLoadingKbs = false,
  showKbSelector = true,
  className = "",
  leftActions
}: SearchInputCardProps) {
  // If inputRef is not provided, create an internal ref
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const actualInputRef = inputRef || internalInputRef;
  const [isKbDropdownOpen, setIsKbDropdownOpen] = useState(false);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };
  
  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter key is pressed but Shift, Ctrl or Command keys are not pressed, submit form
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSubmit();
    }
    // If Enter key is pressed while Ctrl or Command keys are pressed, allow line breaks
    // No additional processing is needed, because this is the default behavior of textarea
  };
  
  // Display selected knowledge base text
  const selectedKbText = selectedKbs.length === 1 
    ? selectedKbs[0] 
    : `Selected ${selectedKbs.length} knowledge bases`;
  
  // Handle knowledge base toggle - Use useCallback to avoid function recreation
  const handleKbToggle = useCallback((kbName: string) => {
    if (onToggleKb) {
      onToggleKb(kbName);
    }
    // Don't close dropdown menu, allow multiple selection
  }, [onToggleKb]);

  // Knowledge base selection dropdown menu - Use useMemo to avoid component recreation
  const KnowledgeBaseMenu = useMemo(() => {
    if (!showKbSelector) return null;
    
    // Determine if any knowledge base is selected for icon color
    const hasSelection = selectedKbs.length > 0;
    
    return (
      <DropdownMenu open={isKbDropdownOpen} onOpenChange={setIsKbDropdownOpen}>
        <Tooltip content="Knowledge Base" side="top">
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:bg-transparent dark:focus:bg-transparent active:bg-transparent dark:active:bg-transparent data-[state=open]:bg-transparent dark:data-[state=open]:bg-transparent ${
                hasSelection 
                  ? 'text-blue-600 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              disabled={isLoadingKbs || disabled}
            >
              {isLoadingKbs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-47">
          {knowledgeBases.map((kb) => (
            <DropdownMenuItem
              key={kb.id}
              onSelect={(event) => {
                event.preventDefault(); // Prevent default close behavior
                handleKbToggle(kb.name);
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>{kb.name}</span>
              {selectedKbs.includes(kb.name) && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [
    showKbSelector, 
    selectedKbs, 
    isKbDropdownOpen, 
    setIsKbDropdownOpen, 
    knowledgeBases, 
    isLoadingKbs, 
    disabled, 
    handleKbToggle
  ]);

  return (
    <Card className={`w-full py-3 ${className}`}>
      <CardContent className={`px-3 ${contentHeight || 'h-22'}`}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e); }} className="space-y-0">
          <Textarea
            ref={actualInputRef}
            className={`w-full ${inputHeight} p-2 border-none resize-none focus-visible:ring-0 shadow-none`}
            style={{ minHeight }}
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center space-x-2">
              {leftActions}
              {KnowledgeBaseMenu}
            </div>
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full" 
              disabled={disabled || isLoading || !value.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 