"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarMenu } from "@/components/ui/menu";
import { MessageSquarePlus, Trash2, Calendar, MessageCircle } from "lucide-react";
import { useTranslations } from '@/i18n/hooks';

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

export default function ChatHistoryPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load chat sessions
  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        console.error("Failed to load chat sessions");
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Continue conversation
  const continueConversation = (sessionId: string) => {
    router.push(`/chat?sessionId=${sessionId}`);
  };

  // Delete session
  const deleteSession = async (sessionId: string) => {
    if (!confirm(t('pages.chatHistory.confirmDelete'))) {
      return;
    }

    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          sessionId
        }),
      });

      if (response.ok) {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      } else {
        alert(t('pages.chatHistory.deleteError'));
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert(t('pages.chatHistory.deleteError'));
    }
  };

  // Create new chat
  const createNewChat = () => {
    router.push('/chat');
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return t('pages.chatHistory.justNow');
    } else if (diffInHours < 24) {
      return t('pages.chatHistory.hoursAgo', { hours: diffInHours });
    } else if (diffInHours < 48) {
      return t('pages.chatHistory.yesterday');
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return t('pages.chatHistory.daysAgo', { days: diffInDays });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SidebarMenu />
      
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t('pages.chatHistory.title')}
          </h1>
          <Button 
            onClick={createNewChat}
            className="flex items-center"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            {t('pages.chatHistory.newChat')}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">
                {t('pages.chatHistory.loading')}
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                {t('pages.chatHistory.noHistory')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('pages.chatHistory.noHistoryDesc')}
              </p>
              <Button onClick={createNewChat}>
                {t('pages.chatHistory.startNewChat')}
              </Button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {sessions.map((session, index) => (
                  <div 
                    key={session.sessionId}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                    onClick={() => continueConversation(session.sessionId)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <MessageCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {session.title || t('pages.chatHistory.untitled')}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <MessageCircle className="w-4 h-4 mr-1" />
                        {t('pages.chatHistory.messageCount', { count: session.messageCount })}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(session.updatedAt)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.sessionId);
                        }}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
