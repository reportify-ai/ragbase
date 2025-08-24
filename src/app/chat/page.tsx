"use client";
import {
  MessageSquarePlus,
  FileText,
  X,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  // Get URL parameters
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get('q') || "";
  const currentSessionId = searchParams.get('sessionId') || uuidv4();
  
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
  const [sessionId, setSessionId] = useState(currentSessionId);
  
  // Update sessionId when URL parameters change
  useEffect(() => {
    console.log("URL sessionId changed:", currentSessionId);
    setSessionId(currentSessionId);
  }, [currentSessionId]);
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
  
  // Used to prevent handleSendMessage from processing the same message repeatedly
  const processingMessageRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Helper function to emit menu update events
  const emitMenuEvent = (eventType: string, data: any) => {
    console.log(`Emitting ${eventType} event:`, data);
    const event = new CustomEvent(eventType, { detail: data });
    window.dispatchEvent(event);
  };
  
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
              // Default to no knowledge base selected
              // setSelectedKbs([data[0].name]);
            }
          } else {
            // If no knowledge base, use default value
            const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
            setKbs([defaultKb]);
            setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
            // setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
          }
        } else {
          console.error("Failed to load knowledge bases");
          // Use default value when loading fails
          const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
          setKbs([defaultKb]);
          setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
          // setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
        }
      } catch (error) {
        console.error("Error loading knowledge bases:", error);
        // Use default value when error occurs
        const defaultKb = { id: 1, name: t('pages.chat.defaultKnowledgeBase'), description: t('pages.chat.defaultKnowledgeBaseDesc') };
        setKbs([defaultKb]);
        setKbIdToNameMap({ 1: t('pages.chat.defaultKnowledgeBase') });
        // setSelectedKbs([t('pages.chat.defaultKnowledgeBase')]);
      } finally {
        setIsLoadingKbs(false);
      }
    }

    loadKnowledgeBases();
  }, []); // Empty dependency array, only executed once when the component is mounted
  
  // Unified function to handle sending messages
  const handleSendMessage = async (messageText: string, isInitialQuestion = false) => {
    console.log("handleSendMessage called", messageText, isInitialQuestion);
    
    // Check if this is actually the first message for a new session
    const isActuallyFirstMessage = isInitialQuestion || messages.length === 0;
    console.log("Is actually first message:", isActuallyFirstMessage, "Messages count:", messages.length);
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
      
      // If it's the first message, set the message array directly; otherwise, append to the existing message
      if (isActuallyFirstMessage) {
        setMessages([userMessage, { role: "ai", content: "", relatedDocuments: [] }]);
      } else {
        // Add user message and empty AI message at once
        setMessages(prev => [...prev, userMessage, { role: "ai", content: "", relatedDocuments: [] }]);
      }
      
      // Get all selected knowledge base IDs
      const kbIds = kbs
        .filter(kb => selectedKbs.includes(kb.name))
        .map(kb => kb.id);
      
      // For new conversations, start title generation in parallel (non-blocking)
      if (isActuallyFirstMessage) {
        console.log("First message detected, starting parallel title generation");
        
        // Start title generation in background without waiting
        const handleTitleGeneration = async () => {
          try {
            console.log("Starting background title generation");
            
            // Generate title based on user message
            const titleResponse = await fetch("/api/chat/generate-title", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: sessionId,
                userMessage: messageText
              }),
            });
            
            let generatedTitle = "New Conversation"; // Fallback
            if (titleResponse.ok) {
              const titleData = await titleResponse.json();
              generatedTitle = titleData.title || generatedTitle;
              console.log("Generated title:", generatedTitle);
            } else {
              console.error("Failed to generate title, using fallback");
            }
            
            // Initialize session in database with title
            const initResponse = await fetch("/api/chat/history", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: sessionId,
                kbIds: kbIds.length > 0 ? kbIds : undefined,
                title: generatedTitle
              }),
            });
            
            if (initResponse.ok) {
              // Add to menu with generated title
              const newSession = {
                id: Date.now(),
                sessionId: sessionId,
                title: generatedTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageCount: 0,
                kbIds: kbIds.length > 0 ? kbIds : undefined,
                isArchived: false
              };
              
              // Emit event to add new session to menu
              emitMenuEvent('newChatSession', newSession);
              
              // Update the title in the menu if it was already added with a temporary title
              emitMenuEvent('updateChatTitle', {
                sessionId: sessionId,
                title: generatedTitle
              });
            }
          } catch (error) {
            console.error("Error in background title generation:", error);
            
            // Fallback: create session with default title
            try {
              await fetch("/api/chat/history", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: sessionId,
                  kbIds: kbIds.length > 0 ? kbIds : undefined,
                  title: "New Conversation"
                }),
              });
              
              const fallbackSession = {
                id: Date.now(),
                sessionId: sessionId,
                title: "New Conversation",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageCount: 0,
                kbIds: kbIds.length > 0 ? kbIds : undefined,
                isArchived: false
              };
              
              emitMenuEvent('newChatSession', fallbackSession);
            } catch (fallbackError) {
              console.error("Error in fallback session creation:", fallbackError);
            }
          }
        };
        
        // Start title generation in background (don't await)
        handleTitleGeneration();
      }
      
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
    // Don't initialize if knowledge bases are still loading
    if (isLoadingKbs) {
      console.log("Knowledge bases still loading, waiting...");
      return;
    }

    console.log("Initializing chat for sessionId:", sessionId, "initialQuestion:", initialQuestion);
    
    // Clear previous state when sessionId changes
    setMessages([]);
    setInput("");
    setSelectedMessageIndex(null);
    setShowRelatedDocs(false);
    setIsLoading(false);
    
    // Reset scroll tracking
    prevMessageCountRef.current = 0;
    isLoadingHistoryRef.current = false;
    
    const initializeChat = async () => {
      // If there is an initial question and the knowledge base has been loaded
      if (initialQuestion) {
        console.log("Processing initial question:", initialQuestion);
        // This is a new session with initial question
        // Check if we have knowledge base parameters from URL (e.g., from homepage)
        const initialKbIds = initialKbIdsRef.current;
        if (initialKbIds.length > 0 && !initialKbIds.includes('')) {
          // We have knowledge base IDs from URL, but only process if kbIdToNameMap is ready
          if (Object.keys(kbIdToNameMap).length > 0) {
            // Map knowledge base IDs to names
            const selectedNames = initialKbIds
              .map(id => kbIdToNameMap[parseInt(id, 10)])
              .filter(Boolean);
            
            if (selectedNames.length > 0) {
              console.log("Setting knowledge bases from URL parameters:", selectedNames);
              setSelectedKbs(selectedNames);
            } else {
              // No matching knowledge bases found, clear selection
              setSelectedKbs([]);
            }
          } else {
            // kbIdToNameMap not ready yet, will be processed in next effect run
            console.log("kbIdToNameMap not ready, waiting...");
            return; // Don't proceed with message handling yet
          }
        } else {
          // No knowledge base parameters from URL, clear selection
          setSelectedKbs([]);
        }
        
        // Use the unified handleSendMessage function to process the initial question
        await handleSendMessage(initialQuestion, true);
      } 
      // If there is no initial question, try to load history
      else {
        console.log("Loading chat history for sessionId:", sessionId);
        try {
          const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.history && Array.isArray(data.history) && data.history.length > 0) {
              // This is an existing session with history
              console.log("Found existing session with history");
              
              // Convert database format to UI format if needed
              const convertedHistory = data.history.map((msg: any) => ({
                role: msg.role === 'human' ? 'user' : msg.role as 'user' | 'ai',
                content: msg.content,
                relatedDocuments: msg.relatedDocuments
              }));
              
              // Restore knowledge base selection from session data
              if (data.session && data.session.kbIds && Array.isArray(data.session.kbIds)) {
                console.log("Restoring knowledge base selection:", data.session.kbIds);
                // Map kbIds to knowledge base names
                const kbNames = data.session.kbIds
                  .map((id: number) => kbIdToNameMap[id])
                  .filter(Boolean);
                
                if (kbNames.length > 0) {
                  setSelectedKbs(kbNames);
                  console.log("Restored knowledge bases:", kbNames);
                } else {
                  // If no matching names found, clear selection
                  setSelectedKbs([]);
                }
              } else {
                // No knowledge base info in session, clear selection
                setSelectedKbs([]);
              }
              
              // Mark that we're loading history so scroll logic knows to scroll to top
              isLoadingHistoryRef.current = true;
              
              // Set messages
              setMessages(convertedHistory);
              console.log("Loaded chat history:", convertedHistory.length, "messages");
              
              // If there are messages with related documents, set up the document ID to name mapping
              convertedHistory.forEach((msg: ChatMessage, index: number) => {
                if (msg.role === 'ai' && msg.relatedDocuments && msg.relatedDocuments.length > 0) {
                  // No need to set selectedMessageIndex here, let user click to view documents
                  console.log(`Message ${index} has ${msg.relatedDocuments.length} related documents`);
                }
              });
            } else {
              // No history found, this is a new session
              console.log("No history found, this is a new session");
              setMessages([]);
              // Reset knowledge base selection for new sessions
              setSelectedKbs([]);
            }
          } else {
            // Failed to load history, treat as new session
            console.log("Failed to load history, treating as new session");
            setMessages([]);
            setSelectedKbs([]);
          }
        } catch (error) {
          console.error("Failed to load chat history:", error);
          // Error loading history, treat as new session
          console.log("Error loading history, treating as new session");
          setMessages([]);
          setSelectedKbs([]);
        }
      }
    };
    
    initializeChat();
  }, [sessionId, initialQuestion, isLoadingKbs, kbIdToNameMap]);
  
  // Track previous message count and loading state to determine scroll behavior
  const prevMessageCountRef = useRef(0);
  const isLoadingHistoryRef = useRef(false);
  
  // Handle scrolling based on message changes
  useEffect(() => {
    const currentMessageCount = messages.length;
    const prevMessageCount = prevMessageCountRef.current;
    
    console.log("Messages changed:", {
      currentCount: currentMessageCount,
      prevCount: prevMessageCount,
      isLoadingHistory: isLoadingHistoryRef.current
    });
    
    if (currentMessageCount > 0) {
      if (isLoadingHistoryRef.current) {
        // Loading history - scroll to top
        console.log("Loading history completed, scrolling to top");
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = 0;
        }
        isLoadingHistoryRef.current = false;
      } else if (currentMessageCount > 0 && currentMessageCount >= prevMessageCount) {
        // Messages added or updated during conversation - scroll to bottom
        console.log("Messages added/updated during conversation, scrolling to bottom");
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    
    // Update the previous count
    prevMessageCountRef.current = currentMessageCount;
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
    
    // Navigate to new chat session
    router.push(`/chat?sessionId=${newSessionId}`);
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
  
  // Automatically focus input field when page loads or session changes
  useEffect(() => {
    if (!isLoadingKbs && inputRef.current) {
      // Add a small delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isLoadingKbs, sessionId]);
  
  // Also focus when component first mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Focus input after messages are loaded (for existing sessions)
  useEffect(() => {
    if (messages.length > 0 && !isLoading && !isLoadingKbs && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length, isLoading, isLoadingKbs]);
  
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex flex-col h-full flex-1 relative">
          {/* Scrollable content area including header and messages */}
          <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
            <div className={`mx-auto ${showRelatedDocs ? 'max-w-3xl' : 'max-w-3xl'}`}>
              {/* Header - now inside scrollable area */}
              <div className="p-8 pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      {t('pages.chat.title')}
                    </h2>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => router.push('/chat/history')}
                      title={t('pages.chatHistory.title')}
                      className="h-8 w-8"
                    >
                      <History className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </div>
                  {NewChatButton}
                </div>
              </div>
              
              {/* Messages area */}
              <div className="px-8 py-6 pb-32">
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
          </div>
          
          {/* Floating input area */}
          <div className="absolute bottom-0 left-0 right-0 px-8 py-4">
            <div className={`mx-auto ${showRelatedDocs ? 'max-w-3xl' : 'max-w-3xl'}`}>
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
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
} 