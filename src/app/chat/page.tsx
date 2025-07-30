"use client";
import {
  MessageSquarePlus,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarMenu } from "@/components/ui/menu";
import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams } from "next/navigation";
import { LoadingDots } from "@/components/ui/loading-dots";
import { MessageBubble } from "@/components/ui/message-bubble";
import { FileOpener } from "@/components/ui/file-opener";
import { SearchInputCard } from "@/components/ui/search-input-card";
import { useTranslations } from '@/i18n/hooks';

// Chat message type
interface ChatMessage {
  role: "user" | "ai";
  content: string;
  // Add related documents field to AI messages
  relatedDocuments?: DocumentReference[];
}

// Knowledge base type
interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

// Document reference type
interface DocumentReference {
  kbId: number;
  fileId: number;
  fileName: string;
  title?: string;
  score: number;
  chunkIndex?: number;
  filePath?: string; // New field
}

// Create a wrapper component to use useSearchParams
function ChatPageContent() {
  const { t } = useTranslations();
  // Get URL parameters
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get('q') || "";
  const initialSessionId = searchParams.get('sessionId') || uuidv4();
  
  // Get knowledge base ID parameters (may be multiple)
  const initialKbIdsRef = useRef<string[]>([]);
  
  // Only get initialKbIds once when the component is mounted
  useEffect(() => {
    initialKbIdsRef.current = searchParams.getAll('kbIds');
  }, []);
  
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [selectedKbs, setSelectedKbs] = useState<string[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [isLoadingKbs, setIsLoadingKbs] = useState(true);
  const [kbIdToNameMap, setKbIdToNameMap] = useState<Record<number, string>>({});
  
  // Current selected message index, used to display related documents
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  
  // Get the related documents of the currently selected message
  const selectedMessageDocuments = useMemo(() => {
    if (selectedMessageIndex !== null && messages[selectedMessageIndex]?.relatedDocuments) {
      return messages[selectedMessageIndex].relatedDocuments || [];
    }
    return [];
  }, [selectedMessageIndex, messages]);
  
  // Use ref instead of state to track if the initial question has been processed, avoid duplicate rendering and execution
  const initialQuestionProcessedRef = useRef(false);
  // Used to prevent handleSendMessage from processing the same message repeatedly
  const processingMessageRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Load knowledge base list - no longer depends on initialKbIds
  useEffect(() => {
    // Prevent duplicate loading
    if (kbs.length > 0 && !isLoadingKbs) return;
    
    async function loadKnowledgeBases() {
      try {
        setIsLoadingKbs(true);
        const response = await fetch('/api/kb');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setKbs(data);
            
            // Create ID to name mapping
            const idToNameMap: Record<number, string> = {};
            data.forEach(kb => {
              idToNameMap[kb.id] = kb.name;
            });
            setKbIdToNameMap(idToNameMap);
            
            // Initialize selected knowledge bases based on URL parameters
            const initialKbIds = initialKbIdsRef.current;
            if (initialKbIds.length > 0) {
              const selectedNames = initialKbIds
                .map(id => idToNameMap[parseInt(id, 10)])
                .filter(Boolean);
              
              if (selectedNames.length > 0) {
                setSelectedKbs(selectedNames);
              } else {
                // If no matching knowledge base, default to the first one
                // setSelectedKbs([data[0].name]);
              }
            } else {
              // Default to the first knowledge base
              setSelectedKbs([data[0].name]);
            }
          } else {
            // If no knowledge base, use default value
            const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
            setKbs([defaultKb]);
            setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
            setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
          }
        } else {
          console.error("Failed to load knowledge bases");
          // Use default value when loading fails
          const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
          setKbs([defaultKb]);
          setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
          setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
        }
      } catch (error) {
        console.error("Error loading knowledge bases:", error);
        // Use default value when error occurs
        const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
        setKbs([defaultKb]);
        setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
        setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
      } finally {
        setIsLoadingKbs(false);
      }
    }

    loadKnowledgeBases();
  }, []); // Empty dependency array, only executed once when the component is mounted
  
  // Unified function to handle sending messages
  const handleSendMessage = async (messageText: string, isInitialQuestion = false) => {
    console.log("handleSendMessage called", messageText, isInitialQuestion);
    if (!messageText.trim() || isLoading) return;
    
    // Prevent duplicate processing of the same message
    if (processingMessageRef.current) {
      console.log("Already processing a message, skipping");
      return;
    }
    processingMessageRef.current = true;
    
    // If the related documents area is expanded, close it first
    if (showRelatedDocs) {
      console.log("Close related documents area");
      setShowRelatedDocs(false);
    }
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Add user message to UI
      const userMessage: ChatMessage = { role: "user", content: messageText };
      
      // If it's the initial question, set the message array directly; otherwise, append to the existing message
      if (isInitialQuestion) {
        setMessages([userMessage, { role: "ai", content: "", relatedDocuments: [] }]);
      } else {
        // Add user message and empty AI message at once
        setMessages(prev => [...prev, userMessage, { role: "ai", content: "", relatedDocuments: [] }]);
      }
      
      // Get all selected knowledge base IDs
      const kbIds = kbs
        .filter(kb => selectedKbs.includes(kb.name))
        .map(kb => kb.id);
      
      // Send request to chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          sessionId: sessionId,
          kbIds: kbIds.length > 0 ? kbIds : [], // Ensure passing empty array instead of undefined
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Process stream response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is null");
      
      let aiResponse = "";
      let isFirstChunk = true;
      let documents: DocumentReference[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode text block
        const text = new TextDecoder().decode(value);
        
        // Check if the first data block contains document information
        if (isFirstChunk) {
          isFirstChunk = false;
          console.log("First chunk received:", text.substring(0, 200)); // Only print the first 200 characters, avoid log too long
          
          // Try to parse document information
          const docsDelimiter = "\n---\n";
          const delimiterIndex = text.indexOf(docsDelimiter);
          console.log("Delimiter found at index:", delimiterIndex);
          
          if (delimiterIndex !== -1) {
            // Extract document information part
            const docsJson = text.substring(0, delimiterIndex);
            console.log("Documents JSON:", docsJson);
            
            try {
              const docsData = JSON.parse(docsJson);
              console.log("Parsed documents data:", docsData);
              if (docsData.type === 'documents' && Array.isArray(docsData.documents)) {
                console.log("Setting related documents:", docsData.documents.length);
                documents = docsData.documents;
                // Automatically select the latest message
                setSelectedMessageIndex(messages.length - 1);
                
                // Immediately update the related documents of the message, even if the content is still empty
                setMessages(prev => {
                  const newMessages = [...prev];
                  // Ensure we always update the last message
                  newMessages[newMessages.length - 1] = { 
                    role: "ai", 
                    content: "",
                    relatedDocuments: documents
                  };
                  return newMessages;
                });
              } else {
                console.log("Invalid document data format:", docsData);
              }
              
              // Only keep the content after the document information as AI response
              aiResponse = text.substring(delimiterIndex + docsDelimiter.length);
              continue;
            } catch (error) {
              console.error("Error parsing documents from stream:", error);
              // If parsing fails, use the entire text as AI response
              aiResponse = text;
            }
          } else {
            // If no delimiter is found, use the entire text as AI response
            aiResponse = text;
          }
        } else {
          // If it's not the first data block, add it directly to the response
          aiResponse += text;
        }
        
        // Update AI message and save related documents
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          // Ensure we always update the last message and keep the existing related documents
          newMessages[newMessages.length - 1] = { 
            role: "ai", 
            content: aiResponse,
            relatedDocuments: documents.length > 0 ? documents : lastMessage.relatedDocuments
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Show error message
      setMessages(prev => {
        const newMessages = [...prev];
        // Ensure we always update the last message
        newMessages[newMessages.length - 1] = { 
          role: "ai", 
          content: t('pages.chat.errorMessage') 
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      processingMessageRef.current = false;
    }
  };
  
  // Handle initial question and load chat history
  useEffect(() => {
    // If the initial question has already been processed, skip
    if (initialQuestionProcessedRef.current) {
      console.log("Initial question already processed, skipping");
      return;
    }
    
    // Modify condition, even if no knowledge base is selected, chat can be initialized
    if (!isLoadingKbs) {
      // Immediately mark as processed to prevent duplicate execution
      initialQuestionProcessedRef.current = true;
      
      // Only execute once when the component is first loaded
      const initializeChat = async () => {
        // If there is an initial question and the knowledge base has been loaded
        if (initialQuestion) {
          console.log("Processing initial question:", initialQuestion);
          // Use the unified handleSendMessage function to process the initial question
          await handleSendMessage(initialQuestion, true);
        } 
        // If there is no initial question, try to load history
        else if (!initialQuestion) {
          console.log("Loading chat history");
          try {
            const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
            if (response.ok) {
              const data = await response.json();
              if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                // Only set messages when the history is not empty
                setMessages(data.history);
              }
            }
          } catch (error) {
            console.error("Failed to load chat history:", error);
          }
        }
      };
      
      initializeChat();
    }
    
    // Cleanup function, reset all refs when the component is unmounted
    return () => {
      initialQuestionProcessedRef.current = false;
      processingMessageRef.current = false;
    };
    // Remove selectedKbs dependency to avoid circular dependency
  }, [initialQuestion, sessionId, isLoadingKbs]);
  
  // Scroll to the bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Send message - form submission processing
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Use the unified send message function
    await handleSendMessage(input);
    
    // Clear input field
    setInput("");
  };
  
  // Create new chat
  const handleNewChat = async () => {
    // Generate new session ID
    const newSessionId = uuidv4();
    
    // Completely reload the page by redirecting to a new URL
    window.location.href = `/chat?sessionId=${newSessionId}`;
  };
  
  // Switch knowledge base selection
  const handleToggleKb = (kb: string) => {
    setSelectedKbs(prev => {
      if (prev.includes(kb)) {
        // Allow unselecting all knowledge bases, no longer limit at least one selected item
        return prev.filter(item => item !== kb);
      } else {
        // If not selected, add
        return [...prev, kb];
      }
    });
  };
  
  // Display selected knowledge base text
  const selectedKbText = selectedKbs.length === 1 
    ? selectedKbs[0] 
    : t('pages.chat.selectedKnowledgeBases', { count: selectedKbs.length });
    
  // Control the display/hide of the related documents area
  const [showRelatedDocs, setShowRelatedDocs] = useState(false);
  
  // Switch the display/hide of the related documents area
  const toggleRelatedDocs = (index?: number) => {
    // If an index is provided, set the selected message index
    if (index !== undefined) {
      setSelectedMessageIndex(index);
    }
    
    // Switch display state
    setShowRelatedDocs(prev => !prev);
  };
  
  // Related documents component
  const RelatedDocs = ({ onClose }: { onClose: () => void }) => {
    // Handle close button
    const handleClose = () => {
      if (onClose) onClose();
    };
    
    // If no message is selected or no related documents, display empty state
    if (selectedMessageIndex === null || selectedMessageDocuments.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <p>{t('pages.chat.noRelatedDocuments')}</p>
        </div>
      );
    }
    
    // Sort documents by score
    const sortedDocs = [...selectedMessageDocuments].sort((a, b) => b.score - a.score);
    
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-sm font-medium">{t('pages.chat.relatedDocuments')}</h3>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sortedDocs.map((doc, index) => {
            // Get knowledge base name
            const kbName = kbIdToNameMap[doc.kbId] || t('pages.chat.knowledgeBaseWithId', { id: doc.kbId });
            
            return (
              <div 
                key={`${doc.fileId}-${doc.chunkIndex}-${index}`} 
                className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {kbName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('pages.chat.relevance')}: {(doc.score).toPrecision(3)}
                  </div>
                </div>
                <h4 className="text-sm font-medium mb-1 truncate">
                  {doc.title || doc.fileName}
                </h4>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {doc.fileName}
                  </div>
                  {doc.filePath && (
                    <FileOpener filePath={doc.filePath} iconOnly={true} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Automatically focus input field
  useEffect(() => {
    if (!isLoadingKbs && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoadingKbs]);
  
  // New chat button
  const NewChatButton = (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex items-center"
      onClick={handleNewChat}
    >
      <MessageSquarePlus className="w-4 h-4 mr-1" /> {t('pages.chat.newChat')}
    </Button>
  );
  
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SidebarMenu />
      
      <div className="flex-1 flex flex-col h-full">
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main chat area */}
          <div className="flex flex-col h-full relative flex-1">
            {/* Page title and control area */}
            <div className="flex items-center px-8 py-4 bg-gray-100 dark:bg-gray-900">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-800 dark:text-white">{t('pages.chat.title')}</span>
              </div>
            </div>
            {/* Message area - scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-6 pb-45" ref={chatContainerRef}>
              <div className={`mx-auto ${showRelatedDocs ? 'max-w-3xl' : 'max-w-3xl'}`}>
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-4 py-2">
                  {t('pages.chat.description')}
                </div>
                {messages.map((msg, i) => (
                  <MessageBubble 
                    key={i} 
                    role={msg.role} 
                    content={msg.content} 
                    isLoading={isLoading && i === messages.length - 1 && msg.role === "ai"}
                    hasRelatedDocs={msg.role === "ai" && !!msg.relatedDocuments && msg.relatedDocuments.length > 0}
                    onShowRelatedDocs={() => toggleRelatedDocs(i)}
                    relatedDocsCount={msg.relatedDocuments?.length || 0}
                  />
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>
            
            {/* Input area - floating at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-8 py-4 bg-transparent dark:bg-transparent border-t-0 border-gray-200 dark:border-gray-800">
              <div className={`mx-auto ${showRelatedDocs ? 'max-w-3xl' : 'max-w-3xl'}`}>
                <div className="mb-2 flex">
                  {NewChatButton}
                </div>
                <SearchInputCard
                  value={input}
                  onChange={setInput}
                  onSubmit={sendMessage}
                  isLoading={isLoading}
                  disabled={isLoadingKbs}
                  placeholder={t('pages.chat.inputPlaceholder')}
                  inputHeight="h-12"
                  minHeight="32px"
                  inputRef={inputRef}
                  knowledgeBases={kbs}
                  selectedKbs={selectedKbs}
                  onToggleKb={handleToggleKb}
                  isLoadingKbs={isLoadingKbs}
                />
              </div>
            </div>
          </div>
          
          {/* Related documents sidebar - can switch display/hide */}
          {showRelatedDocs && (
            <div className="w-80 h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <RelatedDocs onClose={() => setShowRelatedDocs(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
} 