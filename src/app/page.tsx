"use client";
import {
  Database,
  Send,
  ChevronDown,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInputCard } from "@/components/ui/search-input-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarMenu } from "@/components/ui/menu";
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useTranslations } from '@/i18n/hooks';

// Knowledge base type
interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [question, setQuestion] = useState("");
  const [selectedKbs, setSelectedKbs] = useState<string[]>([]); // Initially empty, will be set to default value after loading
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Load knowledge base list
  useEffect(() => {
    async function loadKnowledgeBases() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/kb');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setKbs(data);
            // Default to select the first knowledge base (usually "Default Knowledge Base")
            setSelectedKbs([data[0].name]);
          } else {
            // If there is no knowledge base, display a default value
            setKbs([{ id: 1, name: "Default Knowledge Base", description: "System default knowledge base" }]);
            setSelectedKbs(["Default Knowledge Base"]);
          }
        } else {
          console.error("Failed to load knowledge bases");
          // Use default value when loading fails
          setKbs([{ id: 1, name: "Default Knowledge Base", description: "System default knowledge base" }]);
          setSelectedKbs(["Default Knowledge Base"]);
        }
      } catch (error) {
        console.error("Error loading knowledge bases:", error);
        // Use default value when error occurs
        setKbs([{ id: 1, name: "Default Knowledge Base", description: "System default knowledge base" }]);
        setSelectedKbs(["Default Knowledge Base"]);
      } finally {
        setIsLoading(false);
      }
    }

    loadKnowledgeBases();
  }, []);
  
  // Automatically focus search box
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

  function handleSearchSubmit(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
    }
    
    if (!question.trim()) return;
    
    // Generate new session ID
    const sessionId = uuidv4();
    
    // Encode question and knowledge base information into URL parameters
    const params = new URLSearchParams({
      q: question,
      sessionId: sessionId
    });
    
    // Add selected knowledge base IDs
    const selectedKbIds = kbs
      .filter(kb => selectedKbs.includes(kb.name))
      .map(kb => kb.id.toString());
    
    // Ensure that even if no knowledge base is selected, the correct parameters are passed
    if (selectedKbIds.length > 0) {
      selectedKbIds.forEach(id => {
        params.append('kbIds', id);
      });
    } else {
      // If no knowledge base is selected, add an empty kbIds parameter, ensuring that the API knows that the user explicitly chose not to use a knowledge base
      params.append('kbIds', '');
    }
    
    // Redirect to chat page, with parameters
    router.push(`/chat?${params.toString()}`);
  }
  

  // Handle knowledge base selection
  function toggleKb(kb: string) {
    setSelectedKbs(prev => {
      if (prev.includes(kb)) {
        // Allow unselecting all knowledge bases, no longer limit at least one selected item
        return prev.filter(item => item !== kb);
      } else {
        // If not selected, add
        return [...prev, kb];
      }
    });
  }
  
  // Display selected knowledge base text
  const selectedKbText = selectedKbs.length === 1 
    ? selectedKbs[0] 
    : t('pages.chat.selectedKnowledgeBases', { count: selectedKbs.length });
  
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SidebarMenu />
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-3xl flex flex-col items-center space-y-8">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-gray-800 dark:text-white">
              {t('pages.home.title')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {t('pages.home.subtitle')}
            </p>
          </div>

          {/* Chat Input */}
          <SearchInputCard
            value={question}
            onChange={setQuestion}
            onSubmit={handleSearchSubmit}
            isLoading={isLoading}
            placeholder={t('pages.home.placeholder')}
            inputHeight="h-24"
            contentHeight="h-auto"
            className="py-3"
            inputRef={searchInputRef}
            knowledgeBases={kbs}
            selectedKbs={selectedKbs}
            onToggleKb={toggleKb}
            isLoadingKbs={isLoading}
          />

          {/* Info Cards */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('pages.home.recentChats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('pages.home.recentChatsDesc')}
                </p>
                <Button
                  variant="link"
                  className="p-0 mt-3 h-auto text-black dark:text-white"
                  onClick={() => router.push('/chat')}
                >
                  {t('pages.home.viewHistory')} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('pages.home.knowledgeBaseManagement')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('pages.home.knowledgeBaseManagementDesc')}
                </p>
                <Button asChild
                  variant="link"
                  className="p-0 mt-3 h-auto text-black dark:text-white"
                >
                  <Link href="/kb">{t('pages.home.manageKnowledgeBase')} <ArrowRight className="w-4 h-4 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Questions */}
          <div className="w-full">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t('pages.home.recommendedQuestions')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                t('pages.home.questions.0'),
                t('pages.home.questions.1'),
                t('pages.home.questions.2'),
                t('pages.home.questions.3'),
              ].filter(q => q && q !== '...').map((q: string, index: number) => (
                <Button
                  key={`question-${index}`}
                  variant="outline"
                  className="text-left justify-start h-auto whitespace-normal w-full"
                  onClick={() => {
                    setQuestion(q);
                    
                    // If loading, do not execute operation
                    if (isLoading) return;
                    
                    // Use existing processing function
                    handleSearchSubmit();
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
