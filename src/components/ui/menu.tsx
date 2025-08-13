"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  Database,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { v4 as uuidv4 } from "uuid";
import { useTranslations } from '@/i18n/hooks';

interface SidebarMenuProps {
  appName?: string;
  avatarText?: string;
}

export function SidebarMenu({ appName = "RAGBASE", avatarText = "RB" }: SidebarMenuProps) {
  const pathname = usePathname();
  const { t, loading } = useTranslations();
  
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

  // Show skeleton screen while loading
  if (loading) {
    return (
      <aside className="w-64 bg-white dark:bg-gray-800 flex flex-col min-h-screen">
        <div className="p-4 flex items-center space-x-3 border-b dark:border-gray-700">
          <Avatar>
            <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black">
              {avatarText}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            {appName}
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
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
        <div className="p-2 border-t dark:border-gray-700">
          <Button
            key="skeleton-settings"
            variant="ghost"
            className="w-full justify-start space-x-3"
            disabled
          >
            <Settings className="w-5 h-5" />
            <span className="bg-gray-200 dark:bg-gray-700 h-4 rounded animate-pulse flex-1"></span>
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 flex flex-col min-h-screen">
      <div className="p-4 flex items-center space-x-3 border-b dark:border-gray-700">
        <Avatar>
          <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black">
            {avatarText}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          {appName}
        </h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
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
                  // 生成新的会话ID并跳转
                  window.location.href = `/chat?sessionId=${uuidv4()}`;
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
      <div className="p-2 border-t dark:border-gray-700">
        <Button
          asChild
          variant="ghost"
          className={`w-full justify-start space-x-3 ${pathname === '/settings' ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white' : ''}`}
        >
          <Link href="/settings">
            <Settings className="w-5 h-5" />
            <span>{t('components.menu.settings')}</span>
          </Link>
        </Button>
      </div>
    </aside>
  );
} 