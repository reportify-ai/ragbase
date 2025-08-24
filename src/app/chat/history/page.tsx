"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { MessageSquarePlus, Trash2, Calendar, MessageCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  
  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

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
          sessionId: sessionToDelete
        }),
      });

      if (response.ok) {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.sessionId !== sessionToDelete));
      } else {
        alert(t('pages.chatHistory.deleteError'));
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert(t('pages.chatHistory.deleteError'));
    } finally {
      setSessionToDelete(null);
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
    <div className="p-8 overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t('pages.chatHistory.title')}
          </h2>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center"
            onClick={createNewChat}
          >
            <MessageSquarePlus className="w-4 h-4 mr-1" /> {t('pages.chatHistory.newChat')}
          </Button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-gray-500 dark:text-gray-400">
                {t('pages.chatHistory.loading')}
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
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
            sessions.map((session, index) => (
              <div 
                key={session.sessionId}
                className="group p-4 cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                onClick={() => continueConversation(session.sessionId)}
              >
                {/* Conversation header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <MessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                        {session.title || t('pages.chatHistory.untitled')}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      showDeleteConfirmation(session.sessionId);
                    }}
                    className="p-2 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                
                {/* Conversation metadata */}
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-4 ml-8">
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{t('pages.chatHistory.messageCount', { count: session.messageCount })}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={deleteSession}
        message={t('pages.chatHistory.confirmDelete')}
        confirmText={t('common.buttons.delete')}
        cancelText={t('common.buttons.cancel')}
        confirmVariant="destructive"
      />
    </div>
  );
}
