"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarMenu } from "@/components/ui/menu";
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
          
          {/* Main Content with Platform-specific Layout */}
          {isWindowsOrLinux ? (
            // Windows/Linux: Custom title bar layout
            <main className="flex-1 overflow-hidden flex flex-col relative">
              {/* Title bar for Windows/Linux - 32px height */}
              <div 
                className="h-8 bg-gray-200 dark:bg-gray-700 flex items-center"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
              >
                {/* Empty title bar for system buttons space */}
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
          ) : (
            // macOS: Simple layout with draggable top area
            <main className="flex-1 overflow-hidden relative">
              {/* Draggable area at top */}
              <div 
                className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
              />
              
              {/* Content area */}
              <div className="h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {children}
              </div>
            </main>
          )}
        </div>
      </body>
    </html>
  );
}
