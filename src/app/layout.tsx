"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarMenu } from "@/components/ui/menu";
import { WindowControls } from "@/components/ui/window-controls";
import { usePlatform } from "@/hooks/usePlatform";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Note: Metadata moved to separate file or handled differently due to "use client"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isWindowsOrLinux } = usePlatform();

  return (
    <html lang="en">
      <head>
        <title>RAGBASE</title>
        <meta name="description" content="RAGBASE is local RAG system" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
          <SidebarMenu />
          
          {/* Main Content - Unified Layout for All Platforms */}
          <main className="flex-1 overflow-hidden flex flex-col relative">
            {/* Title bar for all platforms - 32px height */}
            <div 
              className="h-8 flex items-center relative"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              {/* WindowControls only show on Windows/Linux */}
              <WindowControls />
            </div>
            
            {/* Draggable area at top of content */}
            <div 
              className="absolute top-8 left-0 right-0 h-4 z-10 pointer-events-none"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            />
            
            {/* Content area with spacing */}
            <div className="flex-1 overflow-hidden mt-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
