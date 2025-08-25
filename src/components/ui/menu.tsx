"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home,
  MessageCircle,
  Database,
  Settings,
  History,
  MoreHorizontal,
  Edit2,
  Trash2,
  Check,
  X,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { v4 as uuidv4 } from "uuid";
import { useTranslations } from '@/i18n/hooks';
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePlatform } from '@/hooks/usePlatform';

interface ChatSession {
  id: number;
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  kbIds?: number[];
  isArchived: boolean;
}

interface SidebarMenuProps {
  appName?: string;
  avatarText?: string;
}

export function SidebarMenu({ appName = "RAGBASE", avatarText = "RB" }: SidebarMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, loading } = useTranslations();
  const { isWindowsOrLinux } = usePlatform();
  
  // State for chat history
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  
  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const menu = [
    {
      label: t('components.menu.home'),
      href: "/",
      icon: Home,
    },
    {
      label: t('components.menu.chat'),
      href: `/chat?sessionId=${uuidv4()}`,
      icon: MessageCircle,
      generateNewSession: true, // Mark links that need to generate new session IDs
    },
    {
      label: t('components.menu.knowledgeBase'),
      href: "/kb",
      icon: Database,
    },
  ];

  const loadChatSessions = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      } else {
        console.error("Failed to load chat sessions");
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Add new session to the top of the list
  const addNewSession = useCallback((session: ChatSession) => {
    console.log("Adding new session to menu:", session.title);
    setChatSessions(prev => [session, ...prev]);
  }, []);

  // Update session title in the list
  const updateSessionInList = useCallback((sessionId: string, newTitle: string) => {
    setChatSessions(prev => prev.map(session => 
      session.sessionId === sessionId 
        ? { ...session, title: newTitle, updatedAt: new Date().toISOString() }
        : session
    ));
  }, []);

  // Load chat sessions and set up event listeners
  useEffect(() => {
    loadChatSessions();
    
    // Listen for custom events to refresh history
    const handleRefreshHistory = () => {
      loadChatSessions();
    };
    
    // Listen for new session events
    const handleNewSession = (event: CustomEvent) => {
      console.log("Received newChatSession event:", event.detail);
      const newSession = event.detail;
      addNewSession(newSession);
    };
    
    // Listen for title update events
    const handleTitleUpdate = (event: CustomEvent) => {
      console.log("Received updateChatTitle event:", event.detail);
      const { sessionId, title } = event.detail;
      updateSessionInList(sessionId, title);
    };
    
    window.addEventListener('refreshChatHistory', handleRefreshHistory);
    window.addEventListener('newChatSession', handleNewSession as EventListener);
    window.addEventListener('updateChatTitle', handleTitleUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refreshChatHistory', handleRefreshHistory);
      window.removeEventListener('newChatSession', handleNewSession as EventListener);
      window.removeEventListener('updateChatTitle', handleTitleUpdate as EventListener);
    };
  }, [addNewSession, updateSessionInList]);

  // Handle scrollbar visibility
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Add scrolling class to show scrollbar
      scrollContainer.classList.add('scrolling');
      
      // Clear existing timeout
      clearTimeout(scrollTimeout);
      
      // Hide scrollbar after scroll stops
      scrollTimeout = setTimeout(() => {
        scrollContainer.classList.remove('scrolling');
      }, 1000); // Hide after 1 second of no scrolling
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Note: Global functions are now replaced with custom events for better reliability

  // Update session title
  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateTitle',
          sessionId,
          title: newTitle,
        }),
      });

      if (response.ok) {
        // Update local state
        setChatSessions(prev => prev.map(session => 
          session.sessionId === sessionId 
            ? { ...session, title: newTitle }
            : session
        ));
        setEditingSessionId(null);
        setEditingTitle("");
      } else {
        alert(t('components.menu.updateTitleError'));
      }
    } catch (error) {
      console.error("Error updating session title:", error);
      alert(t('components.menu.updateTitleError'));
    }
  };

  // Show delete confirmation dialog
  const showDeleteConfirmation = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteDialog(true);
  };

  // Delete session
  const deleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          sessionId: sessionToDelete,
        }),
      });

      if (response.ok) {
        // Remove from local state
        setChatSessions(prev => prev.filter(s => s.sessionId !== sessionToDelete));
      } else {
        alert(t('components.menu.deleteSessionError'));
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert(t('components.menu.deleteSessionError'));
    } finally {
      setSessionToDelete(null);
    }
  };

  // Start editing title
  const startEditingTitle = (sessionId: string, currentTitle?: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle || "");
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // Confirm editing
  const confirmEditing = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSessionTitle(editingSessionId, editingTitle.trim());
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return t('components.menu.justNow');
    } else if (diffInHours < 24) {
      return t('components.menu.hoursAgo', { hours: diffInHours });
    } else if (diffInHours < 48) {
      return t('components.menu.yesterday');
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return t('components.menu.daysAgo', { days: diffInDays });
    }
  };

  // Show skeleton screen while loading
  if (loading) {
    return (
      <aside className="w-64 bg-white dark:bg-gray-800 flex flex-col min-h-screen">
        {/* Header with Settings - Same as loaded state */}
        <div 
          className="pt-3 pb-1 flex items-center justify-between pr-2 pl-4 bg-white dark:bg-gray-800"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {/* Left: Avatar only for Windows/Linux, spacer for macOS */}
          {isWindowsOrLinux ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src="/icon.png" alt={appName} />
              <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black text-sm">
                {avatarText}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div></div>
          )}
          
          {/* Right: Settings - Always show */}
          <Button
            variant="ghost"
            size="sm"
            className="p-0"
            disabled
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Settings2 className="size-5 !text-gray-500 dark:!text-gray-300" />
          </Button>
        </div>
        
        {/* Main Navigation */}
        <nav className="p-2 space-y-1">
          {menu.map((item, index) => (
            <Button
              key={`skeleton-${item.href}`}
              variant="ghost"
              className="w-full justify-start space-x-3"
              disabled
            >
              <item.icon className="w-5 h-5" />
              <span className="bg-gray-200 dark:bg-gray-700 h-4 rounded animate-pulse flex-1"></span>
            </Button>
          ))}
        </nav>

        {/* Chat History Section - Same skeleton structure */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="bg-gray-200 dark:bg-gray-600 h-4 w-16 rounded animate-pulse"></span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-2 space-y-1">
            {/* Loading skeleton for chat items */}
            {[1, 2, 3].map((_, index) => (
              <div key={`chat-skeleton-${index}`} className="p-2 rounded group relative">
                <div className="bg-gray-200 dark:bg-gray-600 h-4 w-full rounded animate-pulse mb-1"></div>
                <div className="bg-gray-200 dark:bg-gray-600 h-3 w-3/4 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 flex flex-col min-h-screen">
      {/* Header with Settings - Always show Settings button */}
      <div 
        className="pt-3 pb-1 flex items-center justify-between pr-2 pl-3 bg-white dark:bg-gray-800"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Avatar only for Windows/Linux, spacer for macOS */}
        {isWindowsOrLinux ? (
          <Avatar className="w-8 h-8">
            <AvatarImage src="/icon.png" alt={appName} />
            <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black text-sm">
              {avatarText}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div></div>
        )}
        
        {/* Right: Settings - Always show */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="p-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Link href="/settings">
            <Settings2 className="size-5 !text-gray-500 dark:!text-gray-300" />
          </Link>
        </Button>
      </div>
      
      {/* Main Navigation */}
      <nav className="p-2 space-y-1">
        {menu.map((item) => {
          const isActive = pathname === item.href.split('?')[0]; // Ignore query parameters when comparing paths
          
          // If a new session ID is needed, use onClick event instead of direct link
          if (item.generateNewSession) {
            return (
              <Button
                key={item.label}
                variant="ghost"
                className={`w-full justify-start space-x-3 ${isActive ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white" : ""}`}
                onClick={() => {
                  // Generate new session ID and navigate
                  router.push(`/chat?sessionId=${uuidv4()}`);
                }}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Button>
            );
          }
          
          // 常规链接
          return (
            <Button
              asChild
              variant="ghost"
              key={item.href}
              className={`w-full justify-start space-x-3 ${isActive ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white" : ""}`}
            >
              <Link href={item.href}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* Chat History Section */}
      <div className="flex-1 flex flex-col min-h-0 mt-2">
        {/* Chat History Header */}
        <div className="px-3 flex-shrink-0 ml-2 mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300">
              {t('components.menu.chatHistory')}
            </h3>
          </div>
        </div>
        
        {/* Chat History List */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-1 min-h-0 custom-scrollbar short">
          {isLoadingHistory ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="h-9 px-4 mx-2 rounded-md flex items-center">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              </div>
            ))
          ) : chatSessions.length > 0 ? (
            chatSessions.map((session) => (
                              <div
                  key={session.sessionId}
                  className="group relative flex items-center hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md h-9 px-3 mx-2 cursor-pointer"
                onClick={() => {
                  if (editingSessionId !== session.sessionId) {
                    router.push(`/chat?sessionId=${session.sessionId}`);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  {editingSessionId === session.sessionId ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            confirmEditing();
                          } else if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmEditing();
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditing();
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {session.title || t('components.menu.untitled')}
                    </div>
                  )}
                </div>
                
                {editingSessionId !== session.sessionId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingTitle(session.sessionId, session.title);
                        }}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        {t('components.menu.editTitle')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          showDeleteConfirmation(session.sessionId);
                        }}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('components.menu.deleteSession')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))
          ) : null}
        </div>
      </div>

      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={deleteSession}
        message={t('components.menu.confirmDeleteSession')}
        confirmText={t('common.buttons.delete')}
        cancelText={t('common.buttons.cancel')}
        confirmVariant="destructive"
      />
    </aside>
  );
} 