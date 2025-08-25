import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarMenu } from "@/components/ui/menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAGBASE",
  description: "RAGBASE is local RAG system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
          <SidebarMenu />
          <main className="flex-1 overflow-hidden relative">
            {/* Draggable header area */}
            <div 
              className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            />
            <div className="h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
